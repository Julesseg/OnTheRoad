import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { TripSummary } from '@/lib/schema';

// The native chrome is expo-router's Stack.Header / Stack.Title; Header renders
// nothing and Title renders its text so it stays queryable under jsdom.
/* eslint-disable react/display-name -- inline passthrough stand-ins for native views */
vi.mock('expo-router', async () => {
  const React = await import('react');
  const Stack: any = () => null;
  Stack.Header = () => null;
  Stack.Title = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children);
  return { router: { push: vi.fn(), dismissAll: vi.fn() }, Stack };
});
vi.mock('expo-sharing', () => ({ isAvailableAsync: vi.fn(), shareAsync: vi.fn() }));
vi.mock('@/lib/storage', () => ({ wallpaperDisplayUri: vi.fn(), exportTripAsFile: vi.fn() }));
vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
// The progressive-blur overlay pulls native modules (expo-blur, masked-view) that
// can't mount under jsdom; stub it out.
vi.mock('@/components/progressive-blur', () => ({ ProgressiveBlurView: () => null }));
vi.mock('react-native-gesture-handler', () => ({
  Swipeable: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
  GestureHandlerRootView: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
}));
vi.mock('expo-image', () => ({
  Image: ({ accessibilityLabel }: { accessibilityLabel?: string }) =>
    React.createElement('img', { alt: accessibilityLabel }),
}));

import { useTripStore } from '@/lib/store';

const PAST: TripSummary = { id: 'past-1', title: 'Portugal 2024', startDate: '2024-03-01', endDate: '2024-03-10' };
const ACTIVE: TripSummary = { id: 'active-1', title: 'Iceland Now', startDate: '2026-05-01', endDate: '2026-06-30' };
const UPCOMING: TripSummary = { id: 'up-1', title: 'Japan 2027', startDate: '2027-01-10', endDate: '2027-01-20' };

const storeWith = (trips: TripSummary[]) =>
  vi.mocked(useTripStore).mockImplementation((sel: any) =>
    sel({ trips, setDisplayedTrip: vi.fn(), removeTrip: vi.fn() })
  );

import { router } from 'expo-router';

afterEach(() => vi.restoreAllMocks());

describe('ArchivedSheet', () => {
  it('renders only past trips, not active or upcoming ones', async () => {
    storeWith([PAST, ACTIVE, UPCOMING]);
    const { default: ArchivedSheet } = await import('@/app/archived');
    render(<ArchivedSheet />);

    expect(screen.getByText('Portugal 2024')).toBeInTheDocument();
    expect(screen.queryByText('Iceland Now')).not.toBeInTheDocument();
    expect(screen.queryByText('Japan 2027')).not.toBeInTheDocument();
  });

  it('tapping a row calls setDisplayedTrip then dismissAll', async () => {
    const setDisplayedTrip = vi.fn();
    vi.mocked(useTripStore).mockImplementation((sel: any) =>
      sel({ trips: [PAST], setDisplayedTrip, removeTrip: vi.fn() })
    );
    const { default: ArchivedSheet } = await import('@/app/archived');
    render(<ArchivedSheet />);

    fireEvent.click(screen.getByRole('button', { name: 'Portugal 2024' }));

    expect(setDisplayedTrip).toHaveBeenCalledWith('past-1');
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('shows no favorite star for archived trips', async () => {
    storeWith([PAST]);
    const { default: ArchivedSheet } = await import('@/app/archived');
    render(<ArchivedSheet />);

    expect(screen.queryByLabelText('Make favorite')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remove favorite')).not.toBeInTheDocument();
  });
});
