import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { router } from 'expo-router';
import type { Trip } from '@/lib/schema';
import { ItineraryPanel } from '@/components/itinerary-panel';

vi.mock('expo-router', () => ({
  router: { push: vi.fn() },
}));

// @expo/ui renders native SwiftUI views (via requireNativeView) that can't mount under
// jsdom. Mock the primitives as plain DOM passthroughs so row content, headers and the
// Next-up card stay assertable, and Button presses still invoke their onPress handlers.
/* eslint-disable react/display-name -- inline passthrough stand-ins for native views */
vi.mock('@expo/ui/swift-ui', async () => {
  const React = await import('react');
  const pass =
    (tag: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement(tag, null, children);
  const Section = ({ header, children }: { header?: React.ReactNode; children?: React.ReactNode }) =>
    React.createElement('div', null, header, children);
  const Button = ({
    label,
    onPress,
    systemImage,
  }: {
    label?: string;
    onPress?: () => void;
    systemImage?: string;
  }) =>
    React.createElement(
      'button',
      { onClick: onPress, 'data-system-image': systemImage },
      label ?? null,
    );
  const Actions = pass('div');
  const SwipeActions = Object.assign(pass('div'), { Actions });
  const ForEach = pass('div');
  // Images carrying an onTapGesture modifier (the checklist circles) render as
  // buttons so taps and the shown symbol stay assertable.
  const Image = ({
    systemName,
    modifiers,
  }: {
    systemName?: string;
    modifiers?: Record<string, unknown>[];
  }) => {
    const a11y = modifiers?.find((m) => m && '__accessibilityLabel' in m)?.__accessibilityLabel;
    const onTap = modifiers?.find((m) => m && '__onTap' in m)?.__onTap;
    return React.createElement('button', {
      'data-system-image': systemName,
      'aria-label': a11y,
      onClick: onTap,
    });
  };
  return {
    Host: pass('div'),
    List: Object.assign(pass('div'), { ForEach }),
    Section,
    VStack: pass('div'),
    HStack: pass('div'),
    Spacer: () => null,
    Text: pass('span'),
    Image,
    Menu: pass('div'),
    Button,
    SwipeActions,
  };
});

// Modifiers are opaque config objects on the native side; no-op them in tests.
vi.mock('@expo/ui/swift-ui/modifiers', () => {
  const noop = () => ({});
  return {
    listStyle: noop,
    font: noop,
    foregroundStyle: noop,
    contentTransition: noop,
    accessibilityLabel: (label: string) => ({ __accessibilityLabel: label }),
    listRowBackground: noop,
    listRowSeparator: noop,
    listSectionSpacing: noop,
    listSectionMargins: noop,
    frame: noop,
    onTapGesture: (fn: () => void) => ({ __onTap: fn }),
    tint: noop,
    animation: noop,
    Animation: { default: {} },
    background: noop,
    padding: noop,
    scrollContentBackground: noop,
    shapes: { capsule: noop, roundedRectangle: noop, rectangle: noop, ellipse: noop, circle: noop, containerRelativeShape: noop },
  };
});

// The progressive-blur header pulls native modules (expo-blur, masked-view) that
// can't mount under jsdom; stub it out.
vi.mock('@/components/progressive-blur', () => ({ ProgressiveBlurView: () => null }));

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ItineraryPanel', () => {
  it('renders a section header per day with day number and date, plus item rows', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    expect(screen.getByText('Day 1')).toBeInTheDocument();
    expect(screen.getByText('Wed, Jul 1')).toBeInTheDocument();
    expect(screen.getByText('Day 2')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
  });

  it('does not render a NEXT UP pill when the trip is not In progress', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    expect(screen.queryByText('Next up')).not.toBeInTheDocument();
    expect(screen.queryByText('NEXT UP')).not.toBeInTheDocument();
  });

  it('the Edit action on a row opens the item editor for that item', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    fireEvent.click(screen.getAllByText('Edit')[0]);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/trip/[id]/item',
      params: { id: 'trip-1', dayId: 'day-1', itemId: 'a1' },
    });
  });

  it('the add (+) button opens the editor on the create path for its day, with no category (defaults to activity)', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    const addButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('data-system-image') === 'plus');
    expect(addButtons).toHaveLength(2); // one per day, no category menu
    fireEvent.click(addButtons[0]); // Day 1
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/trip/[id]/item',
      params: { id: 'trip-1', dayId: 'day-1' },
    });
  });

  // --- Inline checklists (issue #77) ---

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

  it('shows checklist entries as leading circles (empty / filled checkmark) with a progress count', () => {
    render(<ItineraryPanel trip={tripWithChecklist()} now={BEFORE_TRIP} />);
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Passport' })).toHaveAttribute(
      'data-system-image',
      'circle',
    );
    expect(screen.getByRole('button', { name: 'Sunscreen' })).toHaveAttribute(
      'data-system-image',
      'checkmark.circle.fill',
    );
    expect(screen.getByRole('button', { name: 'Charger' })).toHaveAttribute(
      'data-system-image',
      'circle',
    );
  });

  it('tapping the circle writes through to the store immediately', () => {
    render(<ItineraryPanel trip={tripWithChecklist()} now={BEFORE_TRIP} />);
    fireEvent.click(screen.getByRole('button', { name: 'Passport' }));
    expect(storeActions.toggleChecklistEntry).toHaveBeenCalledWith('trip-1', 'day-1', 'a1', 'c1');
  });

  it('renders no circles or progress on items without a checklist', () => {
    const { container } = render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    expect(
      container.querySelectorAll(
        '[data-system-image="circle"], [data-system-image="checkmark.circle.fill"]',
      ),
    ).toHaveLength(0);
  });

  it('renders a NEXT UP pill on the item row when In progress with an upcoming timed item', () => {
    const inProgress = new Date(2026, 6, 1, 10, 0); // July 1, before the 12:00 activity
    render(<ItineraryPanel trip={TRIP} now={inProgress} />);
    expect(screen.queryByText('Next up')).not.toBeInTheDocument(); // dedicated card gone
    expect(screen.getByText('NEXT UP')).toBeInTheDocument(); // in-place pill
    expect(screen.getAllByText('Lunch')).toHaveLength(1); // no duplication
  });
});
