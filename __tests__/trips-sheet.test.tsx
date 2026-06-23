import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// The native navigation chrome is expo-router's Stack.Header / Stack.Title /
// Stack.Toolbar. Stand the toolbar up as DOM so its buttons (Settings, New trip)
// stay queryable by their accessibility label; Header/Title render nothing
// meaningful under jsdom.
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
  }: {
    accessibilityLabel?: string;
    onPress?: () => void;
  }) => React.createElement('button', { onClick: onPress, 'aria-label': accessibilityLabel });
  // The native toolbar menu renders its actions only once opened; under jsdom
  // the actions are always present, queryable as menuitems inside the menu.
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
  return { router: { push: vi.fn(), dismissAll: vi.fn() }, Stack };
});
vi.mock('expo-sharing', () => ({ isAvailableAsync: vi.fn(), shareAsync: vi.fn() }));
vi.mock('@/lib/storage', () => ({
  wallpaperDisplayUri: vi.fn((uri: string) => `display:${uri}`),
  exportTripAsFile: vi.fn(),
}));
vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
// The progressive-blur overlay pulls native modules (expo-blur, masked-view) that
// can't mount under jsdom; stub it out.
vi.mock('@/components/progressive-blur', () => ({ ProgressiveBlurView: () => null }));
// Pin "today" so the flat-list partition and countdown pills are deterministic;
// keep the real formatters so date-range text is exercised end-to-end.
vi.mock('@/lib/date-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/date-utils')>()),
  todayString: () => '2026-06-02',
}));

// Modifiers are opaque native config. Round-trip the two we assert on so the
// passthrough primitives can act on them: `onTapGesture` carries the row's tap
// handler, and `background` carries the wallpaper-fallback tile color.
vi.mock('@expo/ui/swift-ui/modifiers', () => ({
  listStyle: () => ({}),
  font: () => ({}),
  foregroundStyle: () => ({}),
  frame: () => ({}),
  aspectRatio: () => ({}),
  resizable: () => ({}),
  clipShape: () => ({}),
  padding: () => ({}),
  lineLimit: () => ({}),
  layoutPriority: () => ({}),
  tint: () => ({}),
  glassEffect: () => ({}),
  background: (color: string) => ({ __bg: color }),
  onTapGesture: (handler: () => void) => ({ __onTap: handler }),
  animation: () => ({}),
  Animation: { default: {} },
  shapes: { roundedRectangle: () => ({}), capsule: () => ({}) },
  listRowBackground: () => ({}),
  scrollContentBackground: () => ({}),
  grayscale: () => ({}),
  opacity: () => ({}),
}));

// @expo/ui renders native SwiftUI views that can't mount under jsdom. Stand the
// primitives up as DOM passthroughs: each SwipeActions row is a `[data-row]`
// container, an `onTapGesture`-bearing HStack becomes a clickable div, Buttons
// become clickable buttons, and the wallpaper Image becomes an <img> (an SF
// Symbol Image becomes a `data-symbol` span) so handlers and labels stay queryable.
/* eslint-disable react/display-name -- inline passthrough stand-ins for native views */
vi.mock('@expo/ui/swift-ui', async () => {
  const React = await import('react');
  type Mod = { __onTap?: () => void; __bg?: string };
  const findTap = (mods?: Mod[]) => mods?.find((m) => m && '__onTap' in m)?.__onTap;
  const findBg = (mods?: Mod[]) => mods?.find((m) => m && '__bg' in m)?.__bg;
  const pass =
    (t: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement(t, null, children);

  const HStack = ({ children, modifiers }: { children?: React.ReactNode; modifiers?: Mod[] }) => {
    const onTap = findTap(modifiers);
    return React.createElement('div', onTap ? { onClick: onTap } : null, children);
  };
  const Text = ({ children, modifiers }: { children?: React.ReactNode; modifiers?: Mod[] }) => {
    const bg = findBg(modifiers);
    return React.createElement('span', bg ? { style: { backgroundColor: bg } } : null, children);
  };
  const Image = ({ uiImage, systemName }: { uiImage?: string; systemName?: string }) =>
    uiImage
      ? React.createElement('img', { alt: 'wallpaper', src: uiImage })
      : React.createElement('span', { 'data-symbol': systemName });
  const Button = ({ label, onPress }: { label?: string; onPress?: () => void }) =>
    label ? React.createElement('button', { onClick: onPress }, label) : null;
  const SwipeActions = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-row': '' }, children);
  SwipeActions.Actions = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);

  // Section renders its optional title as a heading so the "Past trips" divider
  // stays queryable.
  const Section = ({ title, children }: { title?: string; children?: React.ReactNode }) =>
    React.createElement(
      'div',
      null,
      title ? React.createElement('h2', null, title) : null,
      children,
    );

  return {
    Host: pass('div'),
    List: pass('div'),
    Section,
    VStack: pass('div'),
    HStack,
    Spacer: () => null,
    Text,
    Image,
    Button,
    SwipeActions,
  };
});

import { useTripStore } from '@/lib/store';
import { router } from 'expo-router';
import { exportTripAsFile } from '@/lib/storage';
import type { TripSummary } from '@/lib/schema';

const trip = (
  over: Partial<TripSummary> & Pick<TripSummary, 'id' | 'startDate' | 'endDate'>,
): TripSummary => ({
  title: over.title ?? over.id,
  wallpaperUri: undefined,
  ...over,
});

// Relative to the pinned today of 2026-06-02.
const inProgress = trip({ id: 'coast', title: 'Coast Run', startDate: '2026-05-30', endDate: '2026-06-10' });
const upcomingSoon = trip({ id: 'desert', title: 'Desert Loop', startDate: '2026-06-05', endDate: '2026-06-12' });
const upcomingLater = trip({ id: 'mountain', title: 'Mountain Pass', startDate: '2026-06-16', endDate: '2026-06-20' });
const past = trip({ id: 'old', title: 'Old Trip', startDate: '2026-05-01', endDate: '2026-05-10' });

const allTrips = [past, upcomingLater, inProgress, upcomingSoon];

const actions = () => ({
  setFavorite: vi.fn(),
  clearFavorite: vi.fn(),
  removeTrip: vi.fn(),
  setDisplayedTrip: vi.fn(),
});

const storeWith = (overrides: object) => {
  const state = {
    trips: [],
    activeTripId: null,
    ...actions(),
    ...overrides,
  };
  vi.mocked(useTripStore).mockImplementation((sel?: any) =>
    typeof sel === 'function' ? sel(state) : state,
  );
  return state;
};

const renderSheet = async () => {
  const { default: TripsSheet } = await import('@/app/trips');
  render(<TripsSheet />);
};

// The SwipeActions row container wrapping a given trip title.
const rowOf = (title: string) =>
  screen.getByText(title).closest('[data-row]') as HTMLElement;

afterEach(() => {
  // restoreAllMocks only restores vi.spyOn spies; module-factory vi.fn()s
  // (router.push/dismissAll, the document picker) keep their call history
  // unless cleared, leaking calls across tests.
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('TripsSheet', () => {
  it('the + menu offers New Trip, which opens the new-trip screen', async () => {
    storeWith({});
    await renderSheet();

    const menu = screen.getByRole('menu', { name: 'Add trip' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'New Trip' }));

    expect(router.push).toHaveBeenCalledWith('/trip/new');
  });

  it('the + menu offers Import Trip, which opens the import sheet', async () => {
    storeWith({});
    await renderSheet();

    const menu = screen.getByRole('menu', { name: 'Add trip' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Import Trip' }));

    expect(router.push).toHaveBeenCalledWith('/import');
  });

  it('the + menu offers no Import Planning Document action', async () => {
    storeWith({});
    await renderSheet();

    const menu = screen.getByRole('menu', { name: 'Add trip' });
    expect(
      within(menu).queryByRole('menuitem', { name: 'Import Planning Document' }),
    ).not.toBeInTheDocument();
  });

  it('tapping the gear button navigates to /settings', async () => {
    storeWith({});
    await renderSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(router.push).toHaveBeenCalledWith('/settings');
  });

  it('renders a flat list of in-progress then upcoming trips, sorted by start date', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    const titles = screen
      .getAllByText(/^(Coast Run|Desert Loop|Mountain Pass)$/)
      .map((e) => e.textContent);
    expect(titles).toEqual(['Coast Run', 'Desert Loop', 'Mountain Pass']);
  });

  it('shows past trips under a "Past trips" section, most recently ended first', async () => {
    const older = trip({ id: 'older', title: 'Older Trip', startDate: '2026-04-01', endDate: '2026-04-10' });
    storeWith({ trips: [...allTrips, older] });
    await renderSheet();

    expect(screen.getByRole('heading', { name: 'Past trips' })).toBeInTheDocument();
    const pastTitles = screen.getAllByText(/^(Old Trip|Older Trip)$/).map((e) => e.textContent);
    expect(pastTitles).toEqual(['Old Trip', 'Older Trip']);
  });

  it('past trip rows expose Edit/Export/Delete but no Favorite action', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    const old = rowOf('Old Trip');
    expect(within(old).queryByRole('button', { name: 'Favorite' })).not.toBeInTheDocument();
    expect(within(old).queryByRole('button', { name: 'Unfavorite' })).not.toBeInTheDocument();
    expect(within(old).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(old).getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(within(old).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('does not split active trips under an in-progress/upcoming divider', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    // Active trips stay a single flat section — only "Past trips" gets a header.
    expect(screen.queryByText('Upcoming')).not.toBeInTheDocument();
    expect(screen.queryByText('In progress', { selector: 'h2' })).not.toBeInTheDocument();
  });

  it('shows title, date range, and an inline countdown pill on each row', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    // The pill mirrors the days sheet's countdownPillLabel: "In progress" while
    // live, then "in N <unit>" counting down in coarse units.
    expect(screen.getByText('Coast Run')).toBeInTheDocument();
    expect(screen.getByText('May 30 – Jun 10, 2026')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('in 3 days')).toBeInTheDocument(); // Desert Loop, 2026-06-05
    expect(screen.getByText('in 2 weeks')).toBeInTheDocument(); // Mountain Pass, 2026-06-16
  });

  it('marks the favorited trip with a star and an Unfavorite action', async () => {
    storeWith({ trips: allTrips, activeTripId: 'desert' });
    await renderSheet();

    const desert = rowOf('Desert Loop');
    const coast = rowOf('Coast Run');
    expect(desert.querySelector('[data-symbol="star.fill"]')).toBeInTheDocument();
    expect(coast.querySelector('[data-symbol="star.fill"]')).not.toBeInTheDocument();
    expect(within(desert).getByRole('button', { name: 'Unfavorite' })).toBeInTheDocument();
    expect(within(coast).getByRole('button', { name: 'Favorite' })).toBeInTheDocument();
  });

  it('shows a map symbol thumbnail when a trip has no wallpaper, and the wallpaper otherwise', async () => {
    const withWallpaper = trip({ id: 'coast', title: 'Coast Run', startDate: '2026-05-30', endDate: '2026-06-10', wallpaperUri: 'trips/coast/wallpaper.jpg' });
    storeWith({ trips: [withWallpaper, upcomingSoon] });
    await renderSheet();

    // Wallpaper row renders the image at the resolved display uri.
    expect(screen.getByRole('img')).toHaveAttribute('src', 'display:trips/coast/wallpaper.jpg');
    // The wallpaper-less row falls back to a map SF Symbol tile.
    expect(rowOf('Desert Loop').querySelector('[data-symbol="map"]')).toBeInTheDocument();
  });

  it('tapping a row sets the Displayed Trip and dismisses back to the map', async () => {
    const state = storeWith({ trips: allTrips });
    await renderSheet();

    fireEvent.click(screen.getByText('Desert Loop'));

    expect(state.setDisplayedTrip).toHaveBeenCalledWith('desert');
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('leading swipe favorites a trip that is not yet the favorite', async () => {
    const state = storeWith({ trips: allTrips, activeTripId: null });
    await renderSheet();

    fireEvent.click(within(rowOf('Desert Loop')).getByRole('button', { name: 'Favorite' }));

    expect(state.setFavorite).toHaveBeenCalledWith('desert');
    expect(state.clearFavorite).not.toHaveBeenCalled();
  });

  it('leading swipe on the current favorite clears it', async () => {
    const state = storeWith({ trips: allTrips, activeTripId: 'desert' });
    await renderSheet();

    fireEvent.click(within(rowOf('Desert Loop')).getByRole('button', { name: 'Unfavorite' }));

    expect(state.clearFavorite).toHaveBeenCalled();
    expect(state.setFavorite).not.toHaveBeenCalled();
  });

  it('trailing swipe exposes Delete, which confirms before removing the trip', async () => {
    const { Alert } = await import('react-native');
    const alertSpy = vi.spyOn(Alert, 'alert');
    const state = storeWith({ trips: allTrips });
    await renderSheet();

    fireEvent.click(within(rowOf('Desert Loop')).getByRole('button', { name: 'Delete' }));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Delete')?.onPress?.();
    expect(state.removeTrip).toHaveBeenCalledWith('desert');
  });

  it('trailing swipe exposes Edit, which opens the trip edit screen', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    fireEvent.click(within(rowOf('Desert Loop')).getByRole('button', { name: 'Edit' }));

    expect(router.push).toHaveBeenCalledWith('/trip/desert/edit');
  });

  it('trailing swipe exposes Export, which exports the trip', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    fireEvent.click(within(rowOf('Desert Loop')).getByRole('button', { name: 'Export' }));

    expect(exportTripAsFile).toHaveBeenCalledWith('desert');
  });
});
