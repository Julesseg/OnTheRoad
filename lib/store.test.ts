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
  importTripFromText: vi.fn(),
}));
vi.mock('./maps', () => ({
  getInstalledMapsApps: vi.fn().mockResolvedValue(['apple']),
  reconcilePreferredMapsApp: vi.fn((app: unknown) => app),
}));
vi.mock('./appearance', () => ({
  applyAppearance: vi.fn(),
}));
vi.mock('./haptics', () => ({
  haptics: { notification: vi.fn(), impact: vi.fn(), selection: vi.fn() },
}));

import * as storage from './storage';
import { applyAppearance } from './appearance';
import { haptics } from './haptics';
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
    schemaVersion: 3,
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

describe('toggleChecklistEntry', () => {
  function tripWithChecklist(): Trip {
    return tripFixture({
      days: [
        {
          id: 'd1',
          date: '2026-07-01',
          items: [
            {
              id: 'i1',
              name: 'Pack bags',
              category: 'activity',
              checklist: [{ id: 'c1', label: 'Passport', checked: false }],
            },
          ],
        },
      ],
    });
  }

  it('flips the entry in the loaded trip and writes through to storage immediately', () => {
    useTripStore.setState({ loadedTrips: { 'trip-1': tripWithChecklist() } });

    useTripStore.getState().toggleChecklistEntry('trip-1', 'd1', 'i1', 'c1');

    const updated = useTripStore.getState().loadedTrips['trip-1'];
    expect(updated.days[0].items[0].checklist![0].checked).toBe(true);
    // Synchronous save — ticking persists without a Save step or debounce.
    expect(storage.saveTrip).toHaveBeenCalledTimes(1);
    expect(vi.mocked(storage.saveTrip).mock.calls[0][0]).toBe(updated);
  });

  it('does not save when the toggle is a no-op (unknown entry)', () => {
    useTripStore.setState({ loadedTrips: { 'trip-1': tripWithChecklist() } });
    useTripStore.getState().toggleChecklistEntry('trip-1', 'd1', 'i1', 'missing');
    expect(storage.saveTrip).not.toHaveBeenCalled();
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

describe('Appearance', () => {
  it('initialize restores the stored appearance and applies it app-wide', async () => {
    vi.mocked(storage.loadState).mockResolvedValue({
      activeTripId: null,
      trips: [],
      preferredMapsApp: 'apple',
      appearance: 'dark',
      lastUpdated: '2026-05-01T00:00:00.000Z',
    });

    await useTripStore.getState().initialize();

    expect(useTripStore.getState().appearance).toBe('dark');
    expect(applyAppearance).toHaveBeenCalledWith('dark');
  });

  it('initialize falls back to system when state.json has no appearance', async () => {
    vi.mocked(storage.loadState).mockResolvedValue(undefined as never);

    await useTripStore.getState().initialize();

    expect(useTripStore.getState().appearance).toBe('system');
    expect(applyAppearance).toHaveBeenCalledWith('system');
  });

  it('setAppearance records the choice, applies it app-wide, and persists it', () => {
    useTripStore.getState().setAppearance('dark');

    expect(useTripStore.getState().appearance).toBe('dark');
    expect(applyAppearance).toHaveBeenCalledWith('dark');
    expect(storage.saveState).toHaveBeenCalledWith(
      expect.objectContaining({ appearance: 'dark' }),
    );
  });
});

describe('importTripText', () => {
  it('validates the pasted JSON, adds the trip, and returns it', async () => {
    const trip = tripFixture();
    vi.mocked(storage.importTripFromText).mockReturnValue(trip);

    const returned = await useTripStore.getState().importTripText('{"pasted":true}');

    expect(storage.importTripFromText).toHaveBeenCalledWith('{"pasted":true}');
    expect(returned).toBe(trip);
    // Added to the store the same way a file import is.
    expect(useTripStore.getState().loadedTrips['trip-1']).toBe(trip);
    expect(useTripStore.getState().trips.find((t) => t.id === 'trip-1')?.title).toBe('Coast');
  });

  it('propagates the validation error and adds nothing when the text is invalid', async () => {
    vi.mocked(storage.importTripFromText).mockImplementation(() => {
      throw new Error('File is not valid JSON.');
    });

    await expect(useTripStore.getState().importTripText('nonsense')).rejects.toThrow(
      'File is not valid JSON.',
    );
    expect(useTripStore.getState().trips).toEqual([]);
  });
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

describe('haptic feedback', () => {
  function tripWithItems(): Trip {
    return tripFixture({
      days: [
        {
          id: 'd1',
          date: '2026-07-01',
          items: [
            { id: 'i1', name: 'Museum', category: 'activity' },
            { id: 'i2', name: 'Lunch', category: 'meal' },
            {
              id: 'i3',
              name: 'Pack',
              category: 'activity',
              checklist: [{ id: 'c1', label: 'Passport', checked: false }],
            },
          ],
        },
        { id: 'd2', date: '2026-07-02', items: [] },
      ],
    });
  }

  it('fires a success notification when a trip is added', async () => {
    await useTripStore.getState().addTrip(tripFixture());
    expect(haptics.notification).toHaveBeenCalledWith('success');
  });

  it('fires a success notification on a successful text import', async () => {
    vi.mocked(storage.importTripFromText).mockReturnValue(tripFixture());
    await useTripStore.getState().importTripText('{}');
    expect(haptics.notification).toHaveBeenCalledWith('success');
  });

  it('fires an error notification when a text import fails', async () => {
    vi.mocked(storage.importTripFromText).mockImplementation(() => {
      throw new Error('File is not valid JSON.');
    });
    await expect(useTripStore.getState().importTripText('nonsense')).rejects.toThrow();
    expect(haptics.notification).toHaveBeenCalledWith('error');
  });

  it('fires an error notification when a file import fails', async () => {
    vi.mocked(storage.importTripFromFile).mockRejectedValue(new Error('bad file'));
    await expect(useTripStore.getState().importTrip('file://x.json')).rejects.toThrow();
    expect(haptics.notification).toHaveBeenCalledWith('error');
  });

  it('fires a light impact when a trip is removed', async () => {
    useTripStore.setState({ trips: [trip('a')] });
    await useTripStore.getState().removeTrip('a');
    expect(haptics.impact).toHaveBeenCalledWith('light');
  });

  it('fires a light impact when an item is deleted', () => {
    useTripStore.setState({ loadedTrips: { 'trip-1': tripWithItems() } });
    useTripStore.getState().deleteItem('trip-1', 'd1', 'i1');
    expect(haptics.impact).toHaveBeenCalledWith('light');
  });

  it('fires a light impact when an item is moved to another day', () => {
    useTripStore.setState({ loadedTrips: { 'trip-1': tripWithItems() } });
    useTripStore.getState().moveItem('trip-1', 'd1', 'd2', 'i1');
    expect(haptics.impact).toHaveBeenCalledWith('light');
  });

  it('fires a light impact when items are reordered', () => {
    useTripStore.setState({ loadedTrips: { 'trip-1': tripWithItems() } });
    useTripStore.getState().reorderItem('trip-1', 'd1', [0], 2);
    expect(haptics.impact).toHaveBeenCalledWith('light');
  });

  it('does not fire when a reorder is a no-op', () => {
    useTripStore.setState({ loadedTrips: { 'trip-1': tripWithItems() } });
    useTripStore.getState().reorderItem('trip-1', 'd1', [0], 0);
    expect(haptics.impact).not.toHaveBeenCalled();
  });

  it('fires a selection tick when a checklist entry is toggled', () => {
    useTripStore.setState({ loadedTrips: { 'trip-1': tripWithItems() } });
    useTripStore.getState().toggleChecklistEntry('trip-1', 'd1', 'i3', 'c1');
    expect(haptics.selection).toHaveBeenCalledTimes(1);
  });

  it('does not fire when a checklist toggle is a no-op', () => {
    useTripStore.setState({ loadedTrips: { 'trip-1': tripWithItems() } });
    useTripStore.getState().toggleChecklistEntry('trip-1', 'd1', 'i3', 'missing');
    expect(haptics.selection).not.toHaveBeenCalled();
  });

  it('fires a light impact when a trip is favorited', () => {
    useTripStore.getState().setFavorite('trip-1');
    expect(haptics.impact).toHaveBeenCalledWith('light');
  });

  it('fires a selection tick when a pin is selected', () => {
    useTripStore.getState().setSelectedPin('i1');
    expect(haptics.selection).toHaveBeenCalledTimes(1);
  });

  it('does not fire when the pin selection is cleared', () => {
    useTripStore.getState().setSelectedPin(null);
    expect(haptics.selection).not.toHaveBeenCalled();
  });
});
