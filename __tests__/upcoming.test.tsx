import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Trip, TripSummary } from '@/lib/schema';
import { useTripStore } from '@/lib/store';
import { router } from 'expo-router';
import UpcomingScreen from '@/app/(tabs)/index';

vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));
vi.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
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
});
