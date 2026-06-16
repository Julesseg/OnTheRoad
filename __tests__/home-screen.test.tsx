import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';

vi.mock('expo-router', () => ({
  router: { push: vi.fn(), dismissAll: vi.fn() },
  useFocusEffect: vi.fn(),
}));
vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
vi.mock('@/lib/date-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/date-utils')>()),
  todayString: () => '2026-06-08',
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
}));
vi.mock('expo-blur', () => ({
  BlurView: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'blur-view' }, children),
}));
vi.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => null,
}));
vi.mock('expo-symbols', () => ({ SymbolView: () => null }));

import { router } from 'expo-router';
import { useTripStore } from '@/lib/store';
import type { Trip, TripSummary } from '@/lib/schema';

function makeTrip(
  id: string,
  items: Trip['days'][number]['items'],
  dates = { startDate: '2026-06-15', endDate: '2026-06-20' },
): Trip {
  return {
    id,
    schemaVersion: 3,
    title: 'Test trip',
    startDate: dates.startDate,
    endDate: dates.endDate,
    days: [{ id: 'd1', date: dates.startDate, items }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeSummary(trip: Trip): TripSummary {
  return { id: trip.id, title: trip.title, startDate: trip.startDate, endDate: trip.endDate };
}

const storeWith = (overrides: object = {}) => {
  const state = {
    trips: [],
    loadedTrips: {},
    displayedTripId: null,
    activeTripId: null,
    todayFilterOverride: null,
    sheetDetentIndex: 1,
    selectedPinId: null,
    initialized: true,
    initialize: vi.fn(),
    loadTripById: vi.fn(),
    setSheetDetentIndex: vi.fn(),
    setSelectedPin: vi.fn(),
    ...overrides,
  };
  vi.mocked(useTripStore).mockImplementation((sel?: unknown) =>
    typeof sel === 'function' ? (sel as (s: typeof state) => unknown)(state) : state,
  );
  return state;
};

const TRIP_ITEMS: Trip['days'][number]['items'] = [
  { category: 'location', id: 'a', name: 'A', location: { lat: 40, lng: -120 } },
  { category: 'location', id: 'b', name: 'B', location: { lat: 42, lng: -110 } },
];

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('HomeScreen', () => {
  it('renders a recenter button when a trip is loaded', async () => {
    const trip = makeTrip('trip-1', TRIP_ITEMS);
    const summary = makeSummary(trip);
    storeWith({ trips: [summary], loadedTrips: { [trip.id]: trip }, activeTripId: trip.id });
    const { default: HomeScreen } = await import('@/app/index');
    render(<HomeScreen />);
    expect(screen.getByLabelText('Recenter')).toBeInTheDocument();
  });

  it('does not render the recenter button when no trip is loaded', async () => {
    storeWith({});
    const { default: HomeScreen } = await import('@/app/index');
    render(<HomeScreen />);
    expect(screen.queryByLabelText('Recenter')).not.toBeInTheDocument();
  });

  it('always offers a distinct center-on-user button, even with no trip', async () => {
    storeWith({});
    const { default: HomeScreen } = await import('@/app/index');
    render(<HomeScreen />);
    // The center-on-user control is separate from the trip-route recenter (scope)
    // button and is available even before a trip loads.
    expect(screen.getByLabelText('Center on my location')).toBeInTheDocument();
    expect(screen.queryByLabelText('Recenter')).not.toBeInTheDocument();
  });

  it('tapping the recenter button re-applies the framed viewport', async () => {
    const trip = makeTrip('trip-1', TRIP_ITEMS);
    const summary = makeSummary(trip);

    storeWith({
      trips: [summary],
      loadedTrips: { [trip.id]: trip },
      activeTripId: trip.id,
    });

    const { default: HomeScreen } = await import('@/app/index');
    render(<HomeScreen />);

    const map = screen.getByTestId('apple-maps-view');
    // Camera is at the framed viewport (not the world-view 0,0).
    const centerAfterLoad = map.getAttribute('data-center')!;
    expect(centerAfterLoad).not.toBe('0,0');
    expect(centerAfterLoad).not.toBe('');

    // Recenter can be tapped without crashing; camera stays at the framed viewport.
    // (Drift→recenter correctness is covered by the TripMap.recenter() unit test.)
    act(() => fireEvent.click(screen.getByLabelText('Recenter')));

    expect(map.getAttribute('data-center')).toBe(centerAfterLoad);
    expect(map.getAttribute('data-zoom')).not.toBe('');
  });

  it('shows the info card for the selected pin', async () => {
    const trip = makeTrip('trip-1', TRIP_ITEMS);
    const summary = makeSummary(trip);
    storeWith({
      trips: [summary],
      loadedTrips: { [trip.id]: trip },
      activeTripId: trip.id,
      selectedPinId: 'a',
    });
    const { default: HomeScreen } = await import('@/app/index');
    render(<HomeScreen />);
    expect(screen.getByLabelText('Pin info card')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('tapping a pin selects it and drops the sheet to the XS peek', async () => {
    const trip = makeTrip('trip-1', TRIP_ITEMS);
    const summary = makeSummary(trip);
    const state = storeWith({
      trips: [summary],
      loadedTrips: { [trip.id]: trip },
      activeTripId: trip.id,
      sheetDetentIndex: 1,
    });
    const { default: HomeScreen } = await import('@/app/index');
    render(<HomeScreen />);

    act(() => fireEvent.click(screen.getByTestId('map-marker-a')));

    expect(state.setSelectedPin).toHaveBeenCalledWith('a');
    // Re-presents the sheet at the XS detent (no imperative native detent setter).
    expect(state.setSheetDetentIndex).toHaveBeenCalledWith(0);
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('does not re-present the sheet when a pin is tapped at the XS peek already', async () => {
    const trip = makeTrip('trip-1', TRIP_ITEMS);
    const summary = makeSummary(trip);
    const state = storeWith({
      trips: [summary],
      loadedTrips: { [trip.id]: trip },
      activeTripId: trip.id,
      sheetDetentIndex: 0,
    });
    const { default: HomeScreen } = await import('@/app/index');
    render(<HomeScreen />);

    act(() => fireEvent.click(screen.getByTestId('map-marker-b')));

    expect(state.setSelectedPin).toHaveBeenCalledWith('b');
    expect(router.dismissAll).not.toHaveBeenCalled();
  });
});
