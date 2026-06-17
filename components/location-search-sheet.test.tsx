import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { LocationSearchSheet } from '@/components/location-search-sheet';
import { usePickerStore } from '@/lib/location-picker-store';

/* eslint-disable react/display-name */
vi.mock('@expo/ui/swift-ui', async () => {
  const React = await import('react');
  const pass =
    (t: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement(t, null, children);
  return {
    Host: pass('div'),
    Form: pass('div'),
    Section: pass('div'),
    Spacer: () => null,
    VStack: pass('div'),
    HStack: pass('div'),
    Text: pass('span'),
    useNativeState: (initial: string) => ({ value: initial }),
    TextField: ({
      placeholder,
      onTextChange,
    }: {
      placeholder?: string;
      onTextChange?: (t: string) => void;
    }) =>
      React.createElement('input', {
        placeholder,
        'aria-label': placeholder,
        onChange: (e: { target: { value: string } }) => onTextChange?.(e.target.value),
      }),
    Button: ({
      label,
      children,
      onPress,
      modifiers,
    }: {
      label?: string;
      children?: React.ReactNode;
      onPress?: () => void;
      modifiers?: { __accessibilityLabel?: string }[];
    }) => {
      const a11y = modifiers?.find((m) => m && '__accessibilityLabel' in m)?.__accessibilityLabel;
      return typeof label === 'string' || children
        ? React.createElement('button', { onClick: onPress, 'aria-label': a11y }, children ?? label)
        : null;
    },
  };
});
vi.mock('@expo/ui/swift-ui/modifiers', () => ({
  font: vi.fn(() => ({})),
  foregroundStyle: vi.fn(() => ({})),
  background: vi.fn(() => ({})),
  buttonStyle: vi.fn(() => ({})),
  listRowBackground: vi.fn(() => ({})),
  scrollContentBackground: vi.fn(() => ({})),
  tint: vi.fn(() => ({})),
  accessibilityLabel: (label: string) => ({ __accessibilityLabel: label }),
}));

const { back } = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock('expo-router', async () => {
  const React = await import('react');
  const Stack: any = () => null;
  Stack.Header = () => null;
  Stack.Toolbar = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  Stack.Toolbar.Button = ({
    children,
    onPress,
    disabled,
    accessibilityLabel,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    accessibilityLabel?: string;
  }) =>
    React.createElement(
      'button',
      { onClick: disabled ? undefined : onPress, disabled, 'aria-label': accessibilityLabel },
      children,
    );
  return {
    Stack,
    router: { back },
    useNavigation: () => ({ addListener: () => () => {}, setOptions: () => {} }),
  };
});

const PIKE_FEATURE = {
  geometry: { coordinates: [-122.3422, 47.6097] },
  properties: { name: 'Pike Place Market', city: 'Seattle', country: 'US' },
};

function photonFetchReturning(features: unknown[]) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features }) });
}

async function flushDebounce(ms = 250) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await act(async () => {});
}

beforeEach(() => {
  back.mockClear();
  usePickerStore.getState().end();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('LocationSearchSheet', () => {
  it('searches, lists results, and Select hands the chosen result to the editor', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([PIKE_FEATURE]));
    const onConfirm = vi.fn();
    usePickerStore.getState().begin(onConfirm);
    render(<LocationSearchSheet />);

    fireEvent.change(screen.getByLabelText('Search or paste a location'), {
      target: { value: 'pike place' },
    });
    await flushDebounce();

    expect(screen.getByText('Seattle, US')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(onConfirm).toHaveBeenCalledWith({
      address: 'Pike Place Market',
      lat: 47.6097,
      lng: -122.3422,
    });
    expect(back).toHaveBeenCalled();
  });

  it('offers the plain-address last resort and commits { address } when chosen', () => {
    const onConfirm = vi.fn();
    usePickerStore.getState().begin(onConfirm);
    render(<LocationSearchSheet />);

    fireEvent.change(screen.getByLabelText('Search or paste a location'), {
      target: { value: 'Paris, France' },
    });
    fireEvent.click(screen.getByRole('button', { name: /use.*plain address/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(onConfirm).toHaveBeenCalledWith({ address: 'Paris, France' });
  });

  it('disables Select until something is selected', () => {
    usePickerStore.getState().begin(() => {});
    render(<LocationSearchSheet />);
    expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();
  });

  it('Cancel leaves the editor location untouched (no confirm)', () => {
    const onConfirm = vi.fn();
    usePickerStore.getState().begin(onConfirm);
    render(<LocationSearchSheet />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(back).toHaveBeenCalled();
  });
});
