import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Trip } from '@/lib/schema';
import { useTripStore } from '@/lib/store';
import { useLocalSearchParams } from 'expo-router';
import DayDetailScreen from '@/app/trip/[id]/day/[dayId]';

vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
vi.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
vi.mock('expo-router', () => ({ useLocalSearchParams: vi.fn(), router: { back: vi.fn() } }));
vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return { SafeAreaView: Passthrough };
});

const mockedStore = vi.mocked(useTripStore);
const mockedParams = vi.mocked(useLocalSearchParams);

const TRIP: Trip = {
  id: 'trip-1',
  schemaVersion: 1,
  title: 'Pacific Coast Highway',
  startDate: '2026-07-01',
  endDate: '2026-07-02',
  days: [
    {
      id: 'day-1',
      date: '2026-07-01',
      items: [
        { type: 'location', id: 'i1', name: 'Golden Gate Bridge', notes: 'pack snacks' },
        { type: 'note', id: 'i2', text: 'remember sunscreen' },
      ],
    },
    { id: 'day-2', date: '2026-07-02', items: [] },
  ],
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedStore.mockReturnValue({ loadedTrips: { 'trip-1': TRIP }, loadTripById: vi.fn() } as never);
});

describe('Day detail', () => {
  it('renders each item in the day in order', () => {
    mockedParams.mockReturnValue({ id: 'trip-1', dayId: 'day-1' });
    render(<DayDetailScreen />);
    expect(screen.getByText('Golden Gate Bridge')).toBeInTheDocument();
    expect(screen.getByText('pack snacks')).toBeInTheDocument();
    expect(screen.getByText('remember sunscreen')).toBeInTheDocument();
  });

  it('shows an empty state when the day has no items', () => {
    mockedParams.mockReturnValue({ id: 'trip-1', dayId: 'day-2' });
    render(<DayDetailScreen />);
    expect(screen.getByText('No items yet')).toBeInTheDocument();
  });

  it('renders items in chronological order regardless of stored order', () => {
    const trip: Trip = {
      ...TRIP,
      days: [
        {
          id: 'day-1',
          date: '2026-07-01',
          items: [
            { type: 'activity', id: 'late', name: 'Dinner', time: '19:00' },
            { type: 'activity', id: 'early', name: 'Breakfast', time: '08:00' },
          ],
        },
      ],
    };
    mockedStore.mockReturnValue({ loadedTrips: { 'trip-1': trip }, loadTripById: vi.fn() } as never);
    mockedParams.mockReturnValue({ id: 'trip-1', dayId: 'day-1' });
    render(<DayDetailScreen />);
    const early = screen.getByText('Breakfast');
    const late = screen.getByText('Dinner');
    expect(early.compareDocumentPosition(late) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
