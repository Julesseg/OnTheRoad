import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Android (Compose) trips variant. @expo/ui/jetpack-compose is globally aliased to
// a DOM stub (vitest.config.ts): a tappable trip row is a Surface(onClick) →
// <button>, the inline Edit/Favorite/Export/Delete actions are Buttons → <button>
// (queried by text), Text → <span>, Card → <div data-testid=card>. The native
// navigation chrome stays expo-router's Stack.Header / Stack.Title / Stack.Toolbar,
// stood up as DOM here so the Settings / New trip / Import buttons stay queryable.
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
  const { default: TripsSheet } = await import('@/app/trips.android');
  render(<TripsSheet />);
};

// The Material Card container wrapping a given trip title.
const rowOf = (title: string) =>
  screen.getByText(title).closest('[data-testid="card"]') as HTMLElement;

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('TripsSheet (Android)', () => {
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

  it('shows title, date range, and an inline countdown pill on each row', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    expect(screen.getByText('Coast Run')).toBeInTheDocument();
    expect(screen.getByText('May 30 – Jun 10, 2026')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Starts in 3 days')).toBeInTheDocument(); // Desert Loop, 2026-06-05
    expect(screen.getByText('Starts in 2 weeks')).toBeInTheDocument(); // Mountain Pass, 2026-06-16
  });

  it('shows past trips under a "Past trips" section, most recently ended first', async () => {
    const older = trip({ id: 'older', title: 'Older Trip', startDate: '2026-04-01', endDate: '2026-04-10' });
    storeWith({ trips: [...allTrips, older] });
    await renderSheet();

    expect(screen.getByText('Past trips')).toBeInTheDocument();
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

  it('shows a map glyph thumbnail when a trip has no wallpaper, and the wallpaper otherwise', async () => {
    const withWallpaper = trip({ id: 'coast', title: 'Coast Run', startDate: '2026-05-30', endDate: '2026-06-10', wallpaperUri: 'trips/coast/wallpaper.jpg' });
    storeWith({ trips: [withWallpaper, upcomingSoon] });
    await renderSheet();

    // Wallpaper row renders the image at the resolved display uri. (react-native-web
    // Image wraps an <img> carrying the src inside an aria-labelled container.)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'display:trips/coast/wallpaper.jpg');
    // The wallpaper-less row falls back to a map Material glyph tile.
    expect(rowOf('Desert Loop').querySelector('[data-icon="map"]')).toBeInTheDocument();
  });

  it('tapping a row sets the Displayed Trip and dismisses back to the map', async () => {
    const state = storeWith({ trips: allTrips });
    await renderSheet();

    // The trip row is a tappable Surface → <button> wrapping the title.
    fireEvent.click(screen.getByText('Desert Loop').closest('button') as HTMLElement);

    expect(state.setDisplayedTrip).toHaveBeenCalledWith('desert');
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('favorites a trip that is not yet the favorite', async () => {
    const state = storeWith({ trips: allTrips, activeTripId: null });
    await renderSheet();

    fireEvent.click(within(rowOf('Desert Loop')).getByRole('button', { name: 'Favorite' }));

    expect(state.setFavorite).toHaveBeenCalledWith('desert');
    expect(state.clearFavorite).not.toHaveBeenCalled();
  });

  it('clears the favorite on the current favorite', async () => {
    const state = storeWith({ trips: allTrips, activeTripId: 'desert' });
    await renderSheet();

    fireEvent.click(within(rowOf('Desert Loop')).getByRole('button', { name: 'Unfavorite' }));

    expect(state.clearFavorite).toHaveBeenCalled();
    expect(state.setFavorite).not.toHaveBeenCalled();
  });

  it('Delete confirms before removing the trip', async () => {
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

  it('Edit opens the trip edit screen', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    fireEvent.click(within(rowOf('Desert Loop')).getByRole('button', { name: 'Edit' }));

    expect(router.push).toHaveBeenCalledWith('/trip/desert/edit');
  });

  it('Export exports the trip', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    fireEvent.click(within(rowOf('Desert Loop')).getByRole('button', { name: 'Export' }));

    expect(exportTripAsFile).toHaveBeenCalledWith('desert');
  });
});
