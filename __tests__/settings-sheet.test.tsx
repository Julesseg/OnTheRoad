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

// Modifiers are opaque native config; tag() must round-trip its value so the
// Picker mock can map each option child back to the value it selects.
vi.mock('@expo/ui/swift-ui/modifiers', () => ({
  pickerStyle: () => ({}),
  tag: (value: string | number) => ({ __tag: value }),
}));

// @expo/ui renders native SwiftUI views that can't mount under jsdom. Stand the
// primitives up as DOM passthroughs: render the Picker as a radiogroup (one radio
// per tagged option) and Buttons as clickable buttons so handlers stay assertable.
/* eslint-disable react/display-name -- inline passthrough stand-ins for native views */
vi.mock('@expo/ui/swift-ui', async () => {
  const React = await import('react');
  const pass =
    (t: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement(t, null, children);
  const Picker = ({
    selection,
    onSelectionChange,
    children,
  }: {
    selection?: string;
    onSelectionChange?: (v: string) => void;
    children?: React.ReactNode;
  }) =>
    React.createElement(
      'div',
      { role: 'radiogroup' },
      React.Children.map(children, (child: any) => {
        const value = (child.props.modifiers ?? []).find((m: any) => m && '__tag' in m)?.__tag;
        return React.createElement(
          'button',
          {
            role: 'radio',
            'aria-checked': String(selection === value),
            onClick: () => onSelectionChange?.(value),
          },
          child.props.children,
        );
      }),
    );
  const Button = ({ label, onPress }: { label?: string; onPress?: () => void }) =>
    label ? React.createElement('button', { onClick: onPress }, label) : null;
  return {
    Host: pass('div'),
    Form: pass('div'),
    Section: pass('div'),
    Picker,
    Button,
    Text: pass('span'),
  };
});

import { useTripStore } from '@/lib/store';
import { router } from 'expo-router';

const storeWith = (overrides: object) =>
  vi.mocked(useTripStore).mockImplementation((sel: any) =>
    sel({
      preferredMapsApp: 'apple',
      installedMapsApps: ['apple', 'google', 'waze'],
      setPreferredMapsApp: vi.fn(),
      importTrip: vi.fn(),
      setDisplayedTrip: vi.fn(),
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
