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
import type { Trip, TripSummary } from './schema';

const initial = useTripStore.getState();

beforeEach(() => {
  useTripStore.setState(initial, true);
  vi.clearAllMocks();
});

function tripFixture(over: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    schemaVersion: 2,
    title: 'Coast',
    startDate: '2026-07-01',
    endDate: '2026-07-02',
    days: [
      { id: 'd1', date: '2026-07-01', items: [] },
      { id: 'd2', date: '2026-07-02', items: [] },
    ],
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

describe('updateTrip', () => {
  it('persists the trip and replaces it in loadedTrips', () => {
    const trip = tripFixture();
    useTripStore.setState({
      trips: [
        { id: 'trip-1', title: 'Coast', startDate: '2026-07-01', endDate: '2026-07-02', wallpaperUri: undefined },
      ],
      loadedTrips: { 'trip-1': trip },
    });

    const edited = tripFixture({ title: 'Coast Run', updatedAt: '2026-06-01T00:00:00.000Z' });
    useTripStore.getState().updateTrip(edited);

    expect(storage.saveTrip).toHaveBeenCalledWith(edited);
    expect(useTripStore.getState().loadedTrips['trip-1']).toBe(edited);
  });

  it('refreshes the matching trip summary (title, dates, wallpaper)', () => {
    const trip = tripFixture();
    useTripStore.setState({
      trips: [
        { id: 'trip-1', title: 'Coast', startDate: '2026-07-01', endDate: '2026-07-02', wallpaperUri: undefined },
        { id: 'other', title: 'Other', startDate: '2026-08-01', endDate: '2026-08-02', wallpaperUri: undefined },
      ],
      loadedTrips: { 'trip-1': trip },
    });

    const edited = tripFixture({
      title: 'Coast Run',
      startDate: '2026-07-01',
      endDate: '2026-07-05',
      wallpaperUri: 'trips/trip-1/wallpaper.jpg',
    });
    useTripStore.getState().updateTrip(edited);

    const summaries = useTripStore.getState().trips;
    expect(summaries.find((t) => t.id === 'trip-1')).toEqual({
      id: 'trip-1',
      title: 'Coast Run',
      startDate: '2026-07-01',
      endDate: '2026-07-05',
      wallpaperUri: 'trips/trip-1/wallpaper.jpg',
    });
    // Other trips are untouched.
    expect(summaries.find((t) => t.id === 'other')?.title).toBe('Other');
  });
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
