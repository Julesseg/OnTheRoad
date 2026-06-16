import { File, Directory, Paths } from 'expo-file-system';
import { AppState, AppStateSchema, Trip, TripSchema } from './schema';
import { importTripFromJson, serializeTrip } from './trip-io';
import { migrateTripData } from './trip-migrate';
import { wallpaperRelativePath } from './wallpaper';
import { RouteCacheData, RouteCacheSchema } from './route-cache';
import { newId } from './id';

const tripsDir = new Directory(Paths.document, 'trips');

function stateFile(): File {
  return new File(Paths.document, 'state.json');
}

function tripFile(id: string): File {
  return new File(tripsDir, `${id}.json`);
}

function ensureTripsDir(): void {
  if (!tripsDir.exists) tripsDir.create({ intermediates: true });
}

// Write to a .tmp file then rename over the destination for crash-safety.
function atomicWrite(dest: File, data: string): void {
  const tmp = new File(dest.parentDirectory, `${dest.name}.tmp`);
  tmp.write(data);
  if (dest.exists) dest.delete();
  tmp.rename(dest.name);
}

export async function loadState(): Promise<AppState | null> {
  const file = stateFile();
  if (!file.exists) return null;
  const raw = await file.text();
  return AppStateSchema.parse(JSON.parse(raw));
}

export function saveState(state: AppState): void {
  atomicWrite(stateFile(), JSON.stringify(state));
}

export async function loadTrip(id: string): Promise<Trip | null> {
  const file = tripFile(id);
  if (!file.exists) return null;
  const raw = await file.text();
  return TripSchema.parse(migrateTripData(JSON.parse(raw)));
}

export function saveTrip(trip: Trip): void {
  ensureTripsDir();
  atomicWrite(tripFile(trip.id), JSON.stringify(trip));
}

export function listTrips(): string[] {
  ensureTripsDir();
  return tripsDir
    .list()
    .filter((entry): entry is File => entry instanceof File && entry.name.endsWith('.json'))
    .map((f) => f.name.replace(/\.json$/, ''));
}

export function deleteTrip(id: string): void {
  const file = tripFile(id);
  if (file.exists) file.delete();
  const dir = new Directory(tripsDir, id);
  if (dir.exists) dir.delete();
}

/**
 * Copy a picked image into the trip's own folder as its durable wallpaper,
 * overwriting any existing one, and return the path relative to
 * DocumentsDirectory to store in `trip.wallpaperUri`. The copy survives the
 * source being removed from the photo library.
 */
export async function saveWallpaper(tripId: string, sourceUri: string): Promise<string> {
  const dir = new Directory(tripsDir, tripId);
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, 'wallpaper.jpg');
  if (dest.exists) dest.delete();
  await new File(sourceUri).copy(dest);
  return wallpaperRelativePath(tripId);
}

/** Resolve a stored relative `wallpaperUri` to a displayable `file://` uri. */
export function wallpaperDisplayUri(relativePath: string): string {
  return new File(Paths.document, relativePath).uri;
}

function routeCacheFile(): File {
  return new File(Paths.document, 'route-cache.json');
}

/**
 * Load the persisted [trip route](../CONTEXT.md#trip-route) leg cache, a derived
 * artifact kept in its own file outside any trip JSON (ADR-0009). A missing or
 * corrupt file degrades to an empty cache — a recompute, never a crash.
 */
export async function loadRouteCache(): Promise<RouteCacheData> {
  const file = routeCacheFile();
  if (!file.exists) return {};
  try {
    return RouteCacheSchema.parse(JSON.parse(await file.text()));
  } catch {
    return {};
  }
}

/** Persist the leg cache so computed legs render instantly on relaunch/offline. */
export function saveRouteCache(data: RouteCacheData): void {
  atomicWrite(routeCacheFile(), JSON.stringify(data));
}

function exportFileName(trip: Trip): string {
  const safe = trip.title
    .replace(/[^a-z0-9-_ ]/gi, '')
    .trim()
    .replace(/\s+/g, '-');
  return safe.length > 0 ? safe : `trip-${trip.id}`;
}

/**
 * Read a `.json` file at `uri`, validate it against the schema, and return a
 * Trip with a fresh id (never overwriting an existing trip). Throws an Error
 * with a user-facing message if the file is missing or invalid. Does not save.
 */
export async function importTripFromFile(uri: string): Promise<Trip> {
  const file = new File(uri);
  if (!file.exists) throw new Error('File not found.');
  const raw = await file.text();
  const result = importTripFromJson(raw, newId());
  if (!result.ok) throw new Error(result.error);
  return result.trip;
}

/**
 * Write a trip's JSON to a shareable file in the cache directory and return its
 * uri (suitable for `expo-sharing`). Throws if the trip is not on disk.
 */
export async function exportTripAsFile(tripId: string): Promise<string> {
  const trip = await loadTrip(tripId);
  if (!trip) throw new Error('Trip not found.');
  const file = new File(Paths.cache, `${exportFileName(trip)}.json`);
  if (file.exists) file.delete();
  file.write(serializeTrip(trip));
  return file.uri;
}
