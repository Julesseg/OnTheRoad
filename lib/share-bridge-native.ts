import { ExtensionStorage } from '@bacons/apple-targets';

import type { TripSummary } from './schema';
import {
  APP_GROUP,
  PENDING_CAPTURES_KEY,
  TRIPS_INDEX_KEY,
  parsePendingCaptures,
  serializeTripsIndex,
  type PendingCapture,
} from './share-bridge';

// The native-backed side of the App Group bridge (ADR-0008). Kept out of
// `share-bridge.ts` so the pure contract stays importable under vitest without the
// `@bacons/apple-targets` native module. Named with a hyphen (not `.native.ts`) so
// Metro treats it as its own module rather than a platform override of the contract.
const storage = new ExtensionStorage(APP_GROUP);

/** Mirror the current trips into the App Group so the extension's pickers stay current. */
export function writeTripsIndex(
  trips: TripSummary[],
  activeTripId: string | null,
  today: string,
): void {
  storage.set(TRIPS_INDEX_KEY, serializeTripsIndex(trips, activeTripId, today));
}

/** Read the captures the extension has queued since the last drain. */
export function readPendingCaptures(): PendingCapture[] {
  return parsePendingCaptures(storage.get(PENDING_CAPTURES_KEY));
}

/** Clear the queue once the app has drained it. */
export function clearPendingCaptures(): void {
  storage.remove(PENDING_CAPTURES_KEY);
}
