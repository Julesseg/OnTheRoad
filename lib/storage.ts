import * as FileSystem from 'expo-file-system';
import { AppState, AppStateSchema, Trip, TripSchema } from './schema';

const BASE_DIR = FileSystem.documentDirectory ?? '';
const STATE_PATH = `${BASE_DIR}state.json`;
const TRIPS_DIR = `${BASE_DIR}trips/`;

async function ensureTripsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(TRIPS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(TRIPS_DIR, { intermediates: true });
  }
}

async function atomicWrite(path: string, data: string): Promise<void> {
  const tmp = `${path}.tmp`;
  await FileSystem.writeAsStringAsync(tmp, data, { encoding: FileSystem.EncodingType.UTF8 });
  await FileSystem.moveAsync({ from: tmp, to: path });
}

export async function loadState(): Promise<AppState | null> {
  const info = await FileSystem.getInfoAsync(STATE_PATH);
  if (!info.exists) return null;
  const raw = await FileSystem.readAsStringAsync(STATE_PATH);
  return AppStateSchema.parse(JSON.parse(raw));
}

export async function saveState(state: AppState): Promise<void> {
  await atomicWrite(STATE_PATH, JSON.stringify(state));
}

export async function loadTrip(id: string): Promise<Trip | null> {
  const path = `${TRIPS_DIR}${id}.json`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  const raw = await FileSystem.readAsStringAsync(path);
  return TripSchema.parse(JSON.parse(raw));
}

export async function saveTrip(trip: Trip): Promise<void> {
  await ensureTripsDir();
  await atomicWrite(`${TRIPS_DIR}${trip.id}.json`, JSON.stringify(trip));
}

export async function listTrips(): Promise<string[]> {
  await ensureTripsDir();
  const entries = await FileSystem.readDirectoryAsync(TRIPS_DIR);
  return entries
    .filter((e) => e.endsWith('.json'))
    .map((e) => e.replace(/\.json$/, ''));
}

export async function deleteTrip(id: string): Promise<void> {
  const path = `${TRIPS_DIR}${id}.json`;
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) await FileSystem.deleteAsync(path);
}
