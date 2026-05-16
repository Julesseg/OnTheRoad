import { File, Directory, Paths } from 'expo-file-system';
import { AppState, AppStateSchema, Trip, TripSchema } from './schema';

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
  return TripSchema.parse(JSON.parse(raw));
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
}
