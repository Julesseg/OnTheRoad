import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('expo-router', () => ({ router: { push: vi.fn(), dismiss: vi.fn() } }));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }));
vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

import { useTripStore } from '@/lib/store';
import { router } from 'expo-router';

const storeWith = (overrides: object) =>
  vi.mocked(useTripStore).mockImplementation((sel: any) =>
    sel({
      preferredMapsApp: 'apple',
      installedMapsApps: ['apple', 'google', 'waze'],
      setPreferredMapsApp: vi.fn(),
      importTrip: vi.fn(),
      ...overrides,
    })
  );

afterEach(() => vi.restoreAllMocks());

describe('SettingsSheet', () => {
  it('shows the current preferred maps app as selected', async () => {
    storeWith({ preferredMapsApp: 'google' });
    const { default: SettingsSheet } = await import('@/app/settings');
    render(<SettingsSheet />);

    const selected = screen.getByRole('radio', { name: /google/i });
    expect(selected).toHaveAttribute('aria-checked', 'true');

    const apple = screen.getByRole('radio', { name: /apple/i });
    expect(apple).toHaveAttribute('aria-checked', 'false');
  });

  it('tapping a different maps app calls setPreferredMapsApp', async () => {
    const setPreferredMapsApp = vi.fn();
    storeWith({ preferredMapsApp: 'apple', setPreferredMapsApp });
    const { default: SettingsSheet } = await import('@/app/settings');
    render(<SettingsSheet />);

    fireEvent.click(screen.getByRole('radio', { name: /google/i }));

    expect(setPreferredMapsApp).toHaveBeenCalledWith('google');
  });

  it('tapping "Archived trips" navigates to /archived', async () => {
    storeWith({});
    const { default: SettingsSheet } = await import('@/app/settings');
    render(<SettingsSheet />);

    fireEvent.click(screen.getByRole('button', { name: /archived trips/i }));

    expect(router.push).toHaveBeenCalledWith('/archived');
  });
});
