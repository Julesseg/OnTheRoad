import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// The /days header is expo-router's Stack.Header / Stack.Title / Stack.Toolbar.
// Stand the toolbar up as DOM so its buttons stay queryable by accessibility
// label; a button's `hidden` and `selected` props surface as data-* attributes so
// the Day-filter visibility tests can assert on them. Header/Title render their
// children plainly. useNavigation hands back a no-op detent listener.
/* eslint-disable react/display-name -- inline passthrough stand-ins for native views */
vi.mock('expo-router', async () => {
  const React = await import('react');
  const Stack: any = () => null;
  Stack.Header = () => null;
  Stack.Title = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children);
  const Toolbar = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  Toolbar.Button = ({
    accessibilityLabel,
    onPress,
    hidden,
    selected,
  }: {
    accessibilityLabel?: string;
    onPress?: () => void;
    hidden?: boolean;
    selected?: boolean;
  }) =>
    React.createElement('button', {
      'aria-label': accessibilityLabel,
      'data-hidden': hidden ? 'true' : 'false',
      'data-selected': selected ? 'true' : 'false',
      onClick: onPress,
    });
  Toolbar.Menu = ({
    accessibilityLabel,
    children,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
  }) => React.createElement('div', { role: 'menu', 'aria-label': accessibilityLabel }, children);
  Toolbar.MenuAction = ({
    children,
    onPress,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
  }) => React.createElement('button', { role: 'menuitem', onClick: onPress }, children);
  Stack.Toolbar = Toolbar;
  return {
    router: { push: vi.fn(), dismissAll: vi.fn() },
    useNavigation: () => ({ addListener: () => () => {} }),
    Stack,
  };
});

// Reanimated drives only the inline-title cross-fade; stand the primitives down to
// inert passthroughs so the header mounts under jsdom.
vi.mock('react-native-reanimated', async () => {
  const React = await import('react');
  return {
    default: {
      View: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('div', null, children),
    },
    useSharedValue: (v: unknown) => ({ value: v }),
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
    runOnUI:
      (fn: (...args: unknown[]) => unknown) =>
      (...args: unknown[]) =>
        fn(...args),
  };
});

vi.mock('expo-sharing', () => ({ isAvailableAsync: vi.fn(), shareAsync: vi.fn() }));
vi.mock('@/lib/storage', () => ({ exportTripAsFile: vi.fn() }));
vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
vi.mock('@/components/progressive-blur', () => ({ ProgressiveBlurView: () => null }));

// The itinerary list is a SwiftUI host that can't mount under jsdom. Stub it as a
// button that fires the caller's onDayPress, standing in for a Day-header tap.
vi.mock('@/components/itinerary-panel', () => ({
  ItineraryPanel: ({ onDayPress }: { onDayPress?: (date: string) => void }) =>
    React.createElement(
      'button',
      { 'aria-label': 'day-header', onClick: () => onDayPress?.('2026-06-08') },
      'day',
    ),
}));

vi.mock('@expo/ui/swift-ui/modifiers', () => ({
  font: () => ({}),
  foregroundStyle: () => ({}),
  padding: () => ({}),
  glassEffect: () => ({}),
  clipShape: () => ({}),
  useScrollGeometryChange: () => ({}),
}));

/* eslint-disable react/display-name -- inline passthrough stand-ins for native views */
vi.mock('@expo/ui/swift-ui', async () => {
  const React = await import('react');
  const pass =
    (t: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement(t, null, children);
  return { VStack: pass('div'), HStack: pass('div'), Text: pass('span') };
});

// Pin "today" so badges/eligibility are deterministic; keep the real formatters.
vi.mock('@/lib/date-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/date-utils')>()),
  todayString: () => '2026-06-07',
}));

import { useTripStore } from '@/lib/store';
import type { Trip, TripSummary } from '@/lib/schema';
import type { DayFilterOverride } from '@/lib/today-filter';

const TODAY = '2026-06-07';

const summary = (
  over: Partial<TripSummary> & Pick<TripSummary, 'id' | 'startDate' | 'endDate'>,
): TripSummary => ({ title: over.title ?? over.id, wallpaperUri: undefined, ...over });

const day = (date: string) => ({ id: date, date, items: [] });
const tripOf = (s: TripSummary, dates: string[]): Trip =>
  ({
    id: s.id,
    schemaVersion: 3,
    title: s.title,
    startDate: s.startDate,
    endDate: s.endDate,
    days: dates.map(day),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }) as Trip;

// In progress today, multi-day with a day matching today → Day filter eligible.
const inProgress = summary({ id: 'coast', title: 'Coast Run', startDate: '2026-06-05', endDate: '2026-06-10' });
const inProgressTrip = tripOf(inProgress, ['2026-06-05', TODAY, '2026-06-10']);
// Upcoming → no Day filter by default; engaged only by tapping a Day header.
const upcoming = summary({ id: 'desert', title: 'Desert Loop', startDate: '2026-06-20', endDate: '2026-06-25' });
const upcomingTrip = tripOf(upcoming, ['2026-06-20', '2026-06-21', '2026-06-22']);

const renderDays = async (opts: {
  trip: Trip;
  override?: DayFilterOverride;
  loaded?: boolean;
}) => {
  const s = opts.trip === inProgressTrip ? inProgress : upcoming;
  const state = {
    trips: [s],
    loadedTrips: opts.loaded === false ? {} : { [s.id]: opts.trip },
    displayedTripId: s.id,
    activeTripId: null,
    todayFilterOverride: opts.override ?? null,
    sheetDetentIndex: 1,
    initialized: true,
    loadTripById: vi.fn(),
    resetDisplayedTrip: vi.fn(),
    removeTrip: vi.fn(),
    setFavorite: vi.fn(),
    setTodayFilterOverride: vi.fn(),
    setSheetDetentIndex: vi.fn(),
    setSelectedPin: vi.fn(),
  };
  vi.mocked(useTripStore).mockImplementation((sel?: any) =>
    typeof sel === 'function' ? sel(state) : state,
  );
  const { default: DaysSheet } = await import('@/app/days');
  render(<DaysSheet />);
  return state;
};

const filterButton = () => screen.queryByLabelText('Filter day');

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('DaysSheet header', () => {
  it('has no overflow menu — the right group is just the Trips button', async () => {
    await renderDays({ trip: inProgressTrip });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Trips')).toBeInTheDocument();
  });

  it('shows the Day filter button (selected) for an eligible In progress trip', async () => {
    await renderDays({ trip: inProgressTrip });

    const button = filterButton();
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('data-hidden', 'false');
    expect(button).toHaveAttribute('data-selected', 'true');
  });

  it('keeps the Day filter button mounted-but-hidden on an Upcoming trip by default', async () => {
    await renderDays({ trip: upcomingTrip });

    const button = filterButton();
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('data-hidden', 'true');
  });

  it('reveals the Day filter button once an Upcoming trip is filtered to a day', async () => {
    await renderDays({ trip: upcomingTrip, override: '2026-06-21' });

    const button = filterButton();
    expect(button).toHaveAttribute('data-hidden', 'false');
    expect(button).toHaveAttribute('data-selected', 'true');
  });

  it('tapping a Day header engages the filter for that day', async () => {
    const state = await renderDays({ trip: upcomingTrip });

    fireEvent.click(screen.getByLabelText('day-header'));

    expect(state.setTodayFilterOverride).toHaveBeenCalledWith('2026-06-08');
  });

  it('does not mount the Day filter button while the trip is still loading', async () => {
    await renderDays({ trip: inProgressTrip, loaded: false });

    expect(filterButton()).not.toBeInTheDocument();
  });
});
