import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

vi.mock('expo-router', () => ({ router: { push: vi.fn(), dismissAll: vi.fn() } }));
vi.mock('expo-sharing', () => ({ isAvailableAsync: vi.fn(), shareAsync: vi.fn() }));
vi.mock('@/lib/storage', () => ({
  wallpaperDisplayUri: vi.fn((uri: string) => `display:${uri}`),
  exportTripAsFile: vi.fn(),
}));
vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
// Pin "today" so the flat-list partition and countdown pills are deterministic;
// keep the real formatters so date-range text is exercised end-to-end.
vi.mock('@/lib/date-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/date-utils')>()),
  todayString: () => '2026-06-02',
}));
vi.mock('expo-glass-effect', () => ({
  GlassView: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
}));
// Render the swipe action panels alongside the row so their buttons are
// queryable; the real Swipeable reveals them on gesture, which jsdom can't drive.
vi.mock('react-native-gesture-handler', () => ({
  Swipeable: ({
    children,
    renderLeftActions,
    renderRightActions,
  }: {
    children?: React.ReactNode;
    renderLeftActions?: () => React.ReactNode;
    renderRightActions?: () => React.ReactNode;
  }) =>
    React.createElement(
      'div',
      null,
      renderLeftActions?.(),
      children,
      renderRightActions?.(),
    ),
  GestureHandlerRootView: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
}));
vi.mock('expo-image', () => ({
  Image: ({ source }: { source?: { uri?: string } }) =>
    React.createElement('img', { alt: 'wallpaper', src: source?.uri }),
}));
vi.mock('expo-symbols', () => ({
  SymbolView: ({ name }: { name?: string }) =>
    React.createElement('span', { 'data-symbol': name }),
}));

import { useTripStore } from '@/lib/store';
import { router } from 'expo-router';
import type { TripSummary } from '@/lib/schema';

const trip = (over: Partial<TripSummary> & Pick<TripSummary, 'id' | 'startDate' | 'endDate'>): TripSummary => ({
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
    typeof sel === 'function' ? sel(state) : state
  );
  return state;
};

const renderSheet = async () => {
  const { default: TripsSheet } = await import('@/app/trips');
  render(<TripsSheet />);
};

afterEach(() => vi.restoreAllMocks());

describe('TripsSheet', () => {
  it('tapping the gear button navigates to /settings', async () => {
    storeWith({});
    await renderSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(router.push).toHaveBeenCalledWith('/settings');
  });

  it('renders a flat list of in-progress then upcoming trips, sorted by start date', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    const cards = screen.getAllByRole('button', { name: /Run|Loop|Pass|Trip/ });
    const labels = cards.map((c) => c.getAttribute('aria-label'));
    expect(labels).toEqual(['Coast Run', 'Desert Loop', 'Mountain Pass']);
  });

  it('does not show archived (past) trips', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    expect(screen.queryByText('Old Trip')).not.toBeInTheDocument();
  });

  it('has no section headers', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Upcoming')).not.toBeInTheDocument();
  });

  it('shows title, date range, and an inline countdown pill on each card', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    // In-progress trip reads "Now"; upcoming trips count down in coarse units.
    expect(screen.getByText('Coast Run')).toBeInTheDocument();
    expect(screen.getByText('May 30 – Jun 10, 2026')).toBeInTheDocument();
    expect(screen.getByText('Now')).toBeInTheDocument();
    expect(screen.getByText('in 3 days')).toBeInTheDocument(); // Desert Loop, 2026-06-05
    expect(screen.getByText('in 2 weeks')).toBeInTheDocument(); // Mountain Pass, 2026-06-16
  });

  it('gives the in-progress "Now" pill a distinct color from the upcoming countdown', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    expect(screen.getByText('Now').parentElement).toHaveStyle({ backgroundColor: '#34C759' });
    expect(screen.getByText('in 3 days').parentElement).toHaveStyle({ backgroundColor: '#007AFF' });
  });

  it('never renders a star button', async () => {
    storeWith({ trips: allTrips, activeTripId: 'coast' });
    await renderSheet();

    expect(screen.queryByText('★')).not.toBeInTheDocument();
    expect(screen.queryByText('☆')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /make favorite|remove favorite/i })).not.toBeInTheDocument();
  });

  it('marks the favorited trip card as selected', async () => {
    storeWith({ trips: allTrips, activeTripId: 'desert' });
    await renderSheet();

    expect(screen.getByRole('button', { name: 'Desert Loop' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Coast Run' })).not.toHaveAttribute('aria-selected', 'true');
  });

  it('shows a map symbol thumbnail when a trip has no wallpaper, and the wallpaper otherwise', async () => {
    const withWallpaper = trip({ id: 'coast', title: 'Coast Run', startDate: '2026-05-30', endDate: '2026-06-10', wallpaperUri: 'trips/coast/wallpaper.jpg' });
    storeWith({ trips: [withWallpaper, upcomingSoon] });
    await renderSheet();

    // Wallpaper card renders the image at the resolved display uri.
    expect(screen.getByRole('img')).toHaveAttribute('src', 'display:trips/coast/wallpaper.jpg');
    // The wallpaper-less card falls back to a map SF Symbol tile.
    expect(document.querySelector('[data-symbol="map"]')).toBeInTheDocument();
  });

  it('tapping a card sets the Displayed Trip and dismisses back to the map', async () => {
    const state = storeWith({ trips: allTrips });
    await renderSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Desert Loop' }));

    expect(state.setDisplayedTrip).toHaveBeenCalledWith('desert');
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('left-swipe favorites a trip that is not yet the favorite', async () => {
    const state = storeWith({ trips: allTrips, activeTripId: null });
    await renderSheet();

    const card = screen.getByRole('button', { name: 'Desert Loop' });
    const row = card.parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /favorite/i }));

    expect(state.setFavorite).toHaveBeenCalledWith('desert');
    expect(state.clearFavorite).not.toHaveBeenCalled();
  });

  it('left-swipe on the current favorite clears it', async () => {
    const state = storeWith({ trips: allTrips, activeTripId: 'desert' });
    await renderSheet();

    const card = screen.getByRole('button', { name: 'Desert Loop' });
    const row = card.parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /favorite/i }));

    expect(state.clearFavorite).toHaveBeenCalled();
    expect(state.setFavorite).not.toHaveBeenCalled();
  });

  it('right-swipe exposes Delete, which confirms before removing the trip', async () => {
    const { Alert } = await import('react-native');
    const alertSpy = vi.spyOn(Alert, 'alert');
    const state = storeWith({ trips: allTrips });
    await renderSheet();

    const card = screen.getByRole('button', { name: 'Desert Loop' });
    const row = card.parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Delete')?.onPress?.();
    expect(state.removeTrip).toHaveBeenCalledWith('desert');
  });

  it('right-swipe exposes Edit, which opens the trip edit screen', async () => {
    storeWith({ trips: allTrips });
    await renderSheet();

    const card = screen.getByRole('button', { name: 'Desert Loop' });
    const row = card.parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));

    expect(router.push).toHaveBeenCalledWith('/trip/desert/edit');
  });

  it('long-press exposes Export and Delete', async () => {
    vi.useFakeTimers();
    const { Alert } = await import('react-native');
    const alertSpy = vi.spyOn(Alert, 'alert');
    storeWith({ trips: allTrips });
    await renderSheet();

    act(() => {
      fireEvent.mouseDown(screen.getByRole('button', { name: 'Desert Loop' }));
      vi.advanceTimersByTime(600);
    });
    vi.useRealTimers();

    const buttons = alertSpy.mock.calls[0][2] as { text: string }[];
    const texts = buttons.map((b) => b.text);
    expect(texts).toContain('Export');
    expect(texts).toContain('Delete');
  });
});
