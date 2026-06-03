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
  const Button = ({ label, onPress }: { label?: string; onPress?: () => void }) =>
    label ? React.createElement('button', { onClick: onPress }, label) : null;
  const Actions = pass('div');
  const SwipeActions = Object.assign(pass('div'), { Actions });
  const ForEach = pass('div');
  return {
    Host: pass('div'),
    List: Object.assign(pass('div'), { ForEach }),
    Section,
    VStack: pass('div'),
    HStack: pass('div'),
    Spacer: () => null,
    Text: pass('span'),
    Image: () => null,
    Menu: pass('div'),
    Button,
    SwipeActions,
    useNativeState: () => ({ value: null }),
  };
});

// Modifiers are opaque config objects on the native side; no-op them in tests.
vi.mock('@expo/ui/swift-ui/modifiers', () => {
  const noop = () => ({});
  return {
    listStyle: noop,
    font: noop,
    foregroundStyle: noop,
    listRowBackground: noop,
    listRowSeparator: noop,
    listSectionSpacing: noop,
    listSectionMargins: noop,
    frame: noop,
    onTapGesture: noop,
    scrollPosition: noop,
    id: noop,
    tint: noop,
    animation: noop,
    Animation: { default: {} },
  };
});

// The progressive-blur header pulls native modules (expo-blur, masked-view) that
// can't mount under jsdom; stub it out.
vi.mock('@/components/progressive-blur', () => ({ ProgressiveBlurView: () => null }));

vi.mock('@/lib/store', () => ({
  useTripStore: (
    selector: (s: {
      preferredMapsApp: string;
      deleteItem: () => void;
      moveItem: () => void;
      reorderItem: () => void;
    }) => unknown,
  ) =>
    selector({
      preferredMapsApp: 'apple',
      deleteItem: vi.fn(),
      moveItem: vi.fn(),
      reorderItem: vi.fn(),
    }),
}));

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
      notes: 'Pack sunscreen',
      items: [{ type: 'activity', id: 'a1', name: 'Lunch', time: '12:00' }],
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
  it('renders a section header per day with day number, date and notes, plus item rows', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    expect(screen.getByText('Day 1')).toBeInTheDocument();
    expect(screen.getByText('Wed, Jul 1')).toBeInTheDocument();
    expect(screen.getByText('Pack sunscreen')).toBeInTheDocument();
    expect(screen.getByText('Day 2')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
  });

  it('does not render a Next-up card when the trip is not In progress', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    expect(screen.queryByText('Next up')).not.toBeInTheDocument();
  });

  it('the Edit action on a row opens the item editor for that item', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    fireEvent.click(screen.getAllByText('Edit')[0]);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/trip/[id]/item',
      params: { id: 'trip-1', dayId: 'day-1', itemId: 'a1' },
    });
  });

  it('renders a Next-up card naming the next item when In progress', () => {
    const inProgress = new Date(2026, 6, 1, 10, 0); // July 1, before the 12:00 activity
    render(<ItineraryPanel trip={TRIP} now={inProgress} />);
    expect(screen.getByText('Next up')).toBeInTheDocument();
    // The item title appears in both the Next-up card and its day's item row.
    expect(screen.getAllByText('Lunch').length).toBeGreaterThanOrEqual(2);
  });
});
