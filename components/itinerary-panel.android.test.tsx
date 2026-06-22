import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { router } from 'expo-router';
import type { Trip } from '@/lib/schema';
import { ItineraryPanel } from '@/components/itinerary-panel.android';

// Android (Compose) itinerary variant. @expo/ui/jetpack-compose is globally aliased
// to a DOM stub (vitest.config.ts): Surface(onClick)/Button/IconButton render as
// <button>, Checkbox as <input type=checkbox>, Text as <span>. The category glyph
// goes through the shared IconSymbol → MaterialIcons (stubbed to <span data-icon>).
vi.mock('expo-router', () => ({
  router: { push: vi.fn() },
}));

const storeActions = vi.hoisted(() => ({
  deleteItem: vi.fn(),
  reorderItem: vi.fn(),
  toggleChecklistEntry: vi.fn(),
}));

vi.mock('@/lib/store', () => ({
  useTripStore: (
    selector: (s: {
      preferredMapsApp: string;
      deleteItem: () => void;
      reorderItem: () => void;
      toggleChecklistEntry: () => void;
    }) => unknown,
  ) =>
    selector({
      preferredMapsApp: 'apple',
      ...storeActions,
    }),
}));

const TRIP: Trip = {
  id: 'trip-1',
  schemaVersion: 3,
  title: 'Pacific Coast Highway',
  startDate: '2026-07-01',
  endDate: '2026-07-02',
  days: [
    {
      id: 'day-1',
      date: '2026-07-01',
      items: [{ id: 'a1', name: 'Lunch', category: 'activity', time: '12:00' }],
    },
    { id: 'day-2', date: '2026-07-02', items: [] },
  ],
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

const BEFORE_TRIP = new Date(2026, 5, 28, 9, 0); // Upcoming — no Next-up

function tripWithChecklist(): Trip {
  return {
    ...TRIP,
    days: [
      {
        id: 'day-1',
        date: '2026-07-01',
        items: [
          {
            id: 'a1',
            name: 'Pack bags',
            category: 'activity',
            checklist: [
              { id: 'c1', label: 'Passport', checked: false },
              { id: 'c2', label: 'Sunscreen', checked: true },
              { id: 'c3', label: 'Charger', checked: false },
            ],
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ItineraryPanel (Android)', () => {
  it('renders a card header per day with day number and date, plus item rows', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    expect(screen.getByText('Day 1')).toBeInTheDocument();
    expect(screen.getByText('Wed, Jul 1')).toBeInTheDocument();
    expect(screen.getByText('Day 2')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
  });

  it('labels an item row with its uppercased category (the tinted type label, no embedded icon)', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    // The category is conveyed by the accent-tinted type label rather than an
    // embedded IconSymbol (which collapsed the Compose row). activity → "Activity".
    expect(screen.getByText('ACTIVITY')).toBeInTheDocument();
  });

  it('does not render a NEXT UP pill when the trip is not In progress', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    expect(screen.queryByText('NEXT UP')).not.toBeInTheDocument();
  });

  it('tapping an item row opens the item editor for that item', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    fireEvent.click(screen.getByText('Lunch'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/trip/[id]/item',
      params: { id: 'trip-1', dayId: 'day-1', itemId: 'a1' },
    });
  });

  it('each item row offers a Delete action wired to the confirm-delete flow', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    // Delete routes through Alert.alert (confirmation), so it does not call the
    // store synchronously; assert the action is present and clickable without throwing.
    const del = screen.getByText('Delete');
    expect(del).toBeInTheDocument();
    fireEvent.click(del);
  });

  it('the "+ Add" button opens the editor on the create path for its day, with no category', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    // The add control is now a labelled "+ Add" TextButton (an IconButton wrapping
    // an embedded IconSymbol rendered as a tiny/broken glyph in Compose).
    const addButtons = screen.getAllByText('+ Add');
    expect(addButtons).toHaveLength(2); // one per day
    fireEvent.click(addButtons[0]); // Day 1
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/trip/[id]/item',
      params: { id: 'trip-1', dayId: 'day-1' },
    });
  });

  it('tapping a day header filters to that day via onDayPress', () => {
    const onDayPress = vi.fn();
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} onDayPress={onDayPress} />);
    fireEvent.click(screen.getByText('Day 1'));
    expect(onDayPress).toHaveBeenCalledWith('2026-07-01');
  });

  // --- Inline checklists (issue #77) ---

  it('shows checklist entries as checkboxes (checked reflects state) with a progress count', () => {
    render(<ItineraryPanel trip={tripWithChecklist()} now={BEFORE_TRIP} />);
    // Progress reads "☑ 1/3" — the count carries a leading check glyph (Compose
    // Text, not an embedded IconSymbol).
    expect(screen.getByText('☑ 1/3')).toBeInTheDocument();
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes).toHaveLength(3);
    expect(boxes.map((b) => b.checked)).toEqual([false, true, false]);
  });

  it('toggling a checklist checkbox writes through to the store immediately', () => {
    render(<ItineraryPanel trip={tripWithChecklist()} now={BEFORE_TRIP} />);
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(boxes[0]); // Passport / c1
    expect(storeActions.toggleChecklistEntry).toHaveBeenCalledWith('trip-1', 'day-1', 'a1', 'c1');
  });

  it('renders no checkboxes or progress on items without a checklist', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('renders a NEXT UP pill on the item row when In progress with an upcoming timed item', () => {
    const inProgress = new Date(2026, 6, 1, 10, 0); // July 1, before the 12:00 activity
    render(<ItineraryPanel trip={TRIP} now={inProgress} />);
    expect(screen.getByText('NEXT UP')).toBeInTheDocument();
    expect(screen.getAllByText('Lunch')).toHaveLength(1); // no duplication
  });
});
