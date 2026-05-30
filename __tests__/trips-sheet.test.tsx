import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('expo-router', () => ({ router: { push: vi.fn(), dismissAll: vi.fn() } }));
vi.mock('expo-sharing', () => ({ isAvailableAsync: vi.fn(), shareAsync: vi.fn() }));
vi.mock('@/lib/storage', () => ({ wallpaperDisplayUri: vi.fn(), exportTripAsFile: vi.fn() }));
vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
vi.mock('expo-glass-effect', () => ({
  GlassView: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
}));
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
import { router } from 'expo-router';

const storeWith = (overrides: object) => {
  const state = {
    trips: [],
    activeTripId: null,
    setFavorite: vi.fn(),
    clearFavorite: vi.fn(),
    removeTrip: vi.fn(),
    setDisplayedTrip: vi.fn(),
    ...overrides,
  };
  vi.mocked(useTripStore).mockImplementation((sel?: any) =>
    typeof sel === 'function' ? sel(state) : state
  );
};

afterEach(() => vi.restoreAllMocks());

describe('TripsSheet', () => {
  it('tapping the gear button navigates to /settings', async () => {
    storeWith({});
    const { default: TripsSheet } = await import('@/app/trips');
    render(<TripsSheet />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(router.push).toHaveBeenCalledWith('/settings');
  });
});
