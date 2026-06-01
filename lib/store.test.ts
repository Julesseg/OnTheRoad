import { describe, it, expect, beforeEach, vi } from 'vitest';

// The store transitively imports expo-file-system (via ./storage) and
// react-native (via ./maps); neither loads in the node test env, and these
// tests only exercise the in-memory Displayed Trip state, so stub both out.
vi.mock('./storage', () => ({
  loadState: vi.fn(),
  saveState: vi.fn(),
  loadTrip: vi.fn(),
  saveTrip: vi.fn(),
  deleteTrip: vi.fn(),
  importTripFromFile: vi.fn(),
}));
vi.mock('./maps', () => ({
  getInstalledMapsApps: vi.fn().mockResolvedValue(['apple']),
  reconcilePreferredMapsApp: vi.fn((app: unknown) => app),
}));

import * as storage from './storage';
import { useTripStore } from './store';
import type { TripSummary } from './schema';

const initial = useTripStore.getState();

beforeEach(() => {
  useTripStore.setState(initial, true);
  vi.clearAllMocks();
});

describe('Displayed Trip', () => {
  it('setDisplayedTrip records the displayed trip id', () => {
    useTripStore.getState().setDisplayedTrip('trip-1');
    expect(useTripStore.getState().displayedTripId).toBe('trip-1');
  });

  it('resetDisplayedTrip clears back to the resolved default', () => {
    useTripStore.getState().setDisplayedTrip('trip-1');
    useTripStore.getState().resetDisplayedTrip();
    expect(useTripStore.getState().displayedTripId).toBeNull();
  });

  it('never persists the Displayed Trip to state.json', () => {
    vi.useFakeTimers();
    try {
      useTripStore.getState().setDisplayedTrip('trip-1');
      useTripStore.getState().resetDisplayedTrip();
      // Flush any debounced writes; a Displayed Trip change must schedule none.
      vi.runAllTimers();
    } finally {
      vi.useRealTimers();
    }
    expect(storage.saveState).not.toHaveBeenCalled();
  });
});

const trip = (id: string): TripSummary => ({
  id,
  title: id,
  startDate: '2026-07-01',
  endDate: '2026-07-10',
  wallpaperUri: undefined,
});

describe('removeTrip — Displayed Trip & favorite', () => {
  it('resets the Displayed Trip when the trip being deleted is the one displayed', async () => {
    useTripStore.setState({ trips: [trip('a'), trip('b')], displayedTripId: 'b' });
    await useTripStore.getState().removeTrip('b');
    expect(useTripStore.getState().displayedTripId).toBeNull();
  });

  it('clears the favorite when the trip being deleted is the favorite', async () => {
    useTripStore.setState({ trips: [trip('a'), trip('b')], activeTripId: 'b' });
    await useTripStore.getState().removeTrip('b');
    expect(useTripStore.getState().activeTripId).toBeNull();
  });

  it('leaves the Displayed Trip and favorite untouched when an unrelated trip is deleted', async () => {
    useTripStore.setState({
      trips: [trip('a'), trip('b'), trip('c')],
      displayedTripId: 'b',
      activeTripId: 'a',
    });
    await useTripStore.getState().removeTrip('c');
    expect(useTripStore.getState().displayedTripId).toBe('b');
    expect(useTripStore.getState().activeTripId).toBe('a');
  });
});
