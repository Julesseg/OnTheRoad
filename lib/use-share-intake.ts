import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { todayString } from './date-utils';
import { processPendingCapture } from './share-capture';
import { clearPendingCaptures, readPendingCaptures } from './share-bridge-native';
import { useTripStore } from './store';

/**
 * Drain the Share Extension's capture queue in the background (ADR-0008). The
 * extension can't open the app on iOS 18+, so it writes captures to the App Group;
 * the app ingests them with no editor on launch (the initial run, since AppState is
 * already `active`) and on every return to the foreground. Captures are processed
 * oldest-first, the queue is cleared up front so a re-entrant foreground can't
 * double-add, and a capture whose trip no longer exists is skipped (v1).
 */
export function useShareIntake(): void {
  const initialized = useTripStore((s) => s.initialized);
  const draining = useRef(false);

  useEffect(() => {
    if (!initialized) return;

    async function drain(): Promise<void> {
      if (draining.current) return;
      draining.current = true;
      try {
        const captures = readPendingCaptures();
        if (captures.length === 0) return;
        clearPendingCaptures();
        const today = todayString();
        const store = useTripStore.getState();
        const ordered = [...captures].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
        for (const capture of ordered) {
          await store.loadTripById(capture.tripId);
          const trip = useTripStore.getState().loadedTrips[capture.tripId];
          if (!trip) continue;
          const processed = await processPendingCapture(capture, trip, today);
          if (processed) {
            useTripStore.getState().upsertItem(processed.tripId, processed.dayId, processed.item);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        draining.current = false;
      }
    }

    drain();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') drain();
    });
    return () => sub.remove();
  }, [initialized]);
}
