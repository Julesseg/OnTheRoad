import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Trip } from '@/lib/schema';
import { useTripStore } from '@/lib/store';
import { useLocalSearchParams } from 'expo-router';
import DayDetailScreen from '@/app/trip/[id]/day/[dayId]';

const rnMocks = vi.hoisted(() => ({
  showActionSheetWithOptions: vi.fn(),
  alert: vi.fn(),
}));

const dragMocks = vi.hoisted(() => ({
  lastOnDragEnd: null as null | ((p: { data: unknown[]; from: number; to: number }) => void),
}));

vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: vi.fn(),
  router: { back: vi.fn(), push: vi.fn() },
}));
vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return { SafeAreaView: Passthrough };
});
// react-native-web doesn't ship ActionSheetIOS; stub it (and Alert) so the
// action-sheet/delete branches are observable from tests.
vi.mock('react-native', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    ActionSheetIOS: { showActionSheetWithOptions: rnMocks.showActionSheetWithOptions },
    Alert: { alert: rnMocks.alert },
  };
});
// The native DraggableFlatList can't render under jsdom; stand in a plain list
// that renders each item via renderItem in the data (stored) order, and
// captures `onDragEnd` so tests can simulate the drag-end gesture.
vi.mock('react-native-draggable-flatlist', async () => {
  const React = await import('react');
  type Params<T> = { item: T; getIndex: () => number; drag: () => void; isActive: boolean };
  const DraggableFlatList = <T,>({
    data,
    renderItem,
    keyExtractor,
    onDragEnd,
  }: {
    data: T[];
    renderItem: (p: Params<T>) => React.ReactNode;
    keyExtractor: (item: T, index: number) => string;
    onDragEnd?: (p: { data: T[]; from: number; to: number }) => void;
  }) => {
    dragMocks.lastOnDragEnd = onDragEnd as typeof dragMocks.lastOnDragEnd;
    return React.createElement(
      'div',
      null,
      data.map((item, index) =>
        React.createElement(
          React.Fragment,
          { key: keyExtractor(item, index) },
          renderItem({ item, getIndex: () => index, drag: () => {}, isActive: false }),
        ),
      ),
    );
  };
  return { default: DraggableFlatList };
});

const mockedStore = vi.mocked(useTripStore);
const mockedParams = vi.mocked(useLocalSearchParams);

const TRIP: Trip = {
  id: 'trip-1',
  schemaVersion: 2,
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

type StoreMock = {
  loadedTrips: Record<string, Trip>;
  loadTripById: ReturnType<typeof vi.fn>;
  reorderItems: ReturnType<typeof vi.fn>;
  moveItem: ReturnType<typeof vi.fn>;
  deleteItem: ReturnType<typeof vi.fn>;
};

let store: StoreMock;

function setStore(overrides: Partial<StoreMock> = {}) {
  store = {
    loadedTrips: { 'trip-1': TRIP },
    loadTripById: vi.fn(),
    reorderItems: vi.fn(),
    moveItem: vi.fn(),
    deleteItem: vi.fn(),
    ...overrides,
  };
  mockedStore.mockReturnValue(store as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  dragMocks.lastOnDragEnd = null;
  setStore();
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

  it('renders items in their stored order, not re-sorted by time', () => {
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
    setStore({ loadedTrips: { 'trip-1': trip } });
    mockedParams.mockReturnValue({ id: 'trip-1', dayId: 'day-1' });
    render(<DayDetailScreen />);
    const dinner = screen.getByText('Dinner');
    const breakfast = screen.getByText('Breakfast');
    expect(dinner.compareDocumentPosition(breakfast) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens the item action sheet when a long-press is released in place', () => {
    mockedParams.mockReturnValue({ id: 'trip-1', dayId: 'day-1' });
    render(<DayDetailScreen />);
    dragMocks.lastOnDragEnd?.({ data: TRIP.days[0].items, from: 0, to: 0 });
    expect(rnMocks.showActionSheetWithOptions).toHaveBeenCalledTimes(1);
    const options = (rnMocks.showActionSheetWithOptions.mock.calls[0][0] as { options: string[] })
      .options;
    expect(options).toEqual(expect.arrayContaining(['Edit', 'Move to day…', 'Delete']));
  });

  it('persists the new order via the store when a drag commits to a new position', () => {
    mockedParams.mockReturnValue({ id: 'trip-1', dayId: 'day-1' });
    render(<DayDetailScreen />);
    dragMocks.lastOnDragEnd?.({ data: TRIP.days[0].items, from: 0, to: 1 });
    expect(store.reorderItems).toHaveBeenCalledWith('trip-1', 'day-1', 0, 1);
  });

  it('omits "Move to day…" from the action sheet on a single-day trip', () => {
    const singleDay: Trip = { ...TRIP, days: [TRIP.days[0]] };
    setStore({ loadedTrips: { 'trip-1': singleDay } });
    mockedParams.mockReturnValue({ id: 'trip-1', dayId: 'day-1' });
    render(<DayDetailScreen />);
    dragMocks.lastOnDragEnd?.({ data: singleDay.days[0].items, from: 0, to: 0 });
    const options = (rnMocks.showActionSheetWithOptions.mock.calls[0][0] as { options: string[] })
      .options;
    expect(options).not.toContain('Move to day…');
    expect(options).toEqual(expect.arrayContaining(['Edit', 'Delete']));
  });
});
