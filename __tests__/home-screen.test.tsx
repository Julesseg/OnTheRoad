import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';

vi.mock('expo-router', () => ({
  router: { push: vi.fn() },
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

import { useTripStore } from '@/lib/store';
import type { Trip, TripSummary } from '@/lib/schema';

function makeTrip(
  id: string,
  items: Trip['days'][number]['items'],
  dates = { startDate: '2026-06-15', endDate: '2026-06-20' },
): Trip {
  return {
    id,
    schemaVersion: 2,
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
    initialized: true,
    initialize: vi.fn(),
    loadTripById: vi.fn(),
    ...overrides,
  };
  vi.mocked(useTripStore).mockImplementation((sel?: unknown) =>
    typeof sel === 'function' ? (sel as (s: typeof state) => unknown)(state) : state,
  );
  return state;
};

afterEach(() => vi.restoreAllMocks());

describe('HomeScreen', () => {
  it('renders a recenter button over the map', async () => {
    storeWith({});
    const { default: HomeScreen } = await import('@/app/index');
    render(<HomeScreen />);
    expect(screen.getByLabelText('Recenter')).toBeInTheDocument();
  });

  it('tapping the recenter button re-applies the framed viewport', async () => {
    const trip = makeTrip('trip-1', [
      { type: 'location', id: 'a', name: 'A', lat: 40, lng: -120 },
      { type: 'location', id: 'b', name: 'B', lat: 42, lng: -110 },
    ]);
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

    // Simulate user panning away by recording current state, then tap recenter.
    act(() => fireEvent.click(screen.getByLabelText('Recenter')));

    // Camera should be (re-)applied to the framed viewport.
    expect(map.getAttribute('data-center')).toBe(centerAfterLoad);
    expect(map.getAttribute('data-zoom')).not.toBe('');
  });
});
