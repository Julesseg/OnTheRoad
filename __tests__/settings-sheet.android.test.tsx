import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Android (Compose) settings variant. @expo/ui/jetpack-compose is globally aliased
// to a DOM stub (vitest.config.ts), so the Material segmented buttons render as
// <button aria-pressed=...> — the selected option is the pressed one.
/* eslint-disable react/display-name -- inline passthrough stand-ins for native views */
vi.mock('expo-router', async () => {
  const React = await import('react');
  const Stack: any = () => null;
  Stack.Header = () => null;
  Stack.Title = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children);
  return { router: { push: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() }, Stack };
});
vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
vi.mock('@/components/progressive-blur', () => ({ ProgressiveBlurView: () => null }));

import { useTripStore } from '@/lib/store';

const storeWith = (overrides: object) =>
  vi.mocked(useTripStore).mockImplementation((sel: any) =>
    sel({
      preferredMapsApp: 'apple',
      installedMapsApps: ['apple', 'google', 'waze'],
      setPreferredMapsApp: vi.fn(),
      appearance: 'system',
      setAppearance: vi.fn(),
      ...overrides,
    }),
  );

afterEach(() => vi.restoreAllMocks());

describe('SettingsSheet (Android)', () => {
  it('shows the current preferred maps app as the pressed segment', async () => {
    storeWith({ preferredMapsApp: 'google' });
    const { default: SettingsSheet } = await import('@/app/settings.android');
    render(<SettingsSheet />);
    expect(screen.getByRole('button', { name: /google/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /apple/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('tapping a different maps app calls setPreferredMapsApp', async () => {
    const setPreferredMapsApp = vi.fn();
    storeWith({ preferredMapsApp: 'apple', setPreferredMapsApp });
    const { default: SettingsSheet } = await import('@/app/settings.android');
    render(<SettingsSheet />);
    fireEvent.click(screen.getByRole('button', { name: /google/i }));
    expect(setPreferredMapsApp).toHaveBeenCalledWith('google');
  });

  it('shows and changes the appearance segment', async () => {
    const setAppearance = vi.fn();
    storeWith({ appearance: 'dark', setAppearance });
    const { default: SettingsSheet } = await import('@/app/settings.android');
    render(<SettingsSheet />);
    expect(screen.getByRole('button', { name: /dark/i })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /light/i }));
    expect(setAppearance).toHaveBeenCalledWith('light');
  });

  it('only offers installed maps apps', async () => {
    storeWith({ installedMapsApps: ['google', 'waze'] });
    const { default: SettingsSheet } = await import('@/app/settings.android');
    render(<SettingsSheet />);
    expect(screen.queryByRole('button', { name: /apple/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /waze/i })).toBeInTheDocument();
  });
});
