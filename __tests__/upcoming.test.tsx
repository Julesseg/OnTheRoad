import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { Trip, TripSummary } from '@/lib/schema';
import { useTripStore } from '@/lib/store';
import { router } from 'expo-router';
import UpcomingScreen from '@/app/(tabs)/index';

vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));
vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return { SafeAreaView: Passthrough };
});
vi.mock('expo-glass-effect', async () => {
  const React = await import('react');
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return { GlassView: Passthrough, GlassContainer: Passthrough };
});

const mockedStore = vi.mocked(useTripStore);

// Far-future dates so the trip is always "upcoming" regardless of the run date.
const SUMMARY: TripSummary = {
  id: 'trip-1',
  title: 'Pacific Coast Highway',
  startDate: '2099-07-01',
  endDate: '2099-07-02',
};

const TRIP: Trip = {
  id: 'trip-1',
  schemaVersion: 1,
  title: 'Pacific Coast Highway',
  startDate: '2099-07-01',
  endDate: '2099-07-02',
  days: [
    { id: 'day-1', date: '2099-07-01', items: [{ type: 'note', id: 'i1', text: 'go' }] },
    { id: 'day-2', date: '2099-07-02', items: [] },
  ],
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

function setStore(state: Record<string, unknown>) {
  mockedStore.mockReturnValue({
    initialized: true,
    initialize: vi.fn(),
    loadTripById: vi.fn(),
    trips: [],
    loadedTrips: {},
    ...state,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Upcoming tab', () => {
  it('shows an empty state when there are no upcoming trips', () => {
    setStore({ trips: [], loadedTrips: {} });
    render(<UpcomingScreen />);
    expect(screen.getByText('No upcoming trips')).toBeInTheDocument();
  });

  it("renders the selected trip's days once it is loaded", () => {
    setStore({ trips: [SUMMARY], loadedTrips: { 'trip-1': TRIP } });
    render(<UpcomingScreen />);
    expect(screen.getByText('Pacific Coast Highway')).toBeInTheDocument();
    expect(screen.getByText('2099-07-01')).toBeInTheDocument();
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('navigates to the day detail when a day is tapped', () => {
    setStore({ trips: [SUMMARY], loadedTrips: { 'trip-1': TRIP } });
    render(<UpcomingScreen />);
    fireEvent.click(screen.getByText('2099-07-01'));
    expect(router.push).toHaveBeenCalledWith('/trip/trip-1/day/day-1');
  });

  it('shows a "Starts in N days" affordance before the trip begins', () => {
    setStore({ trips: [SUMMARY], loadedTrips: { 'trip-1': TRIP } });
    render(<UpcomingScreen />);
    expect(screen.getByText(/Starts in \d+ days?/)).toBeInTheDocument();
  });

  it('renders the full-screen map background even when there are no trips', () => {
    setStore({ trips: [], loadedTrips: {} });
    render(<UpcomingScreen />);
    expect(screen.getByTestId('apple-maps-view')).toBeInTheDocument();
  });

  it("plots the selected trip's location coords as map pins", () => {
    const tripWithPins: Trip = {
      ...TRIP,
      days: [
        {
          id: 'day-1',
          date: '2099-07-01',
          items: [
            { type: 'location', id: 'p1', name: 'Big Sur', lat: 36.2704, lng: -121.8081 },
            { type: 'location', id: 'p2', name: 'Hearst', lat: 35.6852, lng: -121.1685 },
          ],
        },
        { id: 'day-2', date: '2099-07-02', items: [] },
      ],
    };
    setStore({ trips: [SUMMARY], loadedTrips: { 'trip-1': tripWithPins } });
    render(<UpcomingScreen />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-markers')).toBe(
      '36.2704,-121.8081;35.6852,-121.1685',
    );
  });
});

const INPROGRESS_SUMMARY: TripSummary = {
  id: 'trip-2',
  title: 'Desert Loop',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
};

const INPROGRESS_TRIP: Trip = {
  id: 'trip-2',
  schemaVersion: 1,
  title: 'Desert Loop',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  days: [
    { id: 'd1', date: '2026-07-01', items: [] },
    {
      id: 'd2',
      date: '2026-07-02',
      items: [
        { type: 'activity', id: 'x', name: 'Sunrise hike', time: '06:00' },
        { type: 'location', id: 'y', name: 'Canyon Overlook', time: '11:00' },
      ],
    },
    { id: 'd3', date: '2026-07-03', items: [] },
  ],
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

describe('Upcoming tab — today companion', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the current day's items in the big-type companion when in progress", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 2, 10, 0));
    setStore({ trips: [INPROGRESS_SUMMARY], loadedTrips: { 'trip-2': INPROGRESS_TRIP } });
    render(<UpcomingScreen />);
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Canyon Overlook')).toBeInTheDocument();
    const nextUpCard = screen.getByText('Next up').parentElement as HTMLElement;
    expect(within(nextUpCard).getByText('Canyon Overlook')).toBeInTheDocument();
  });
});
