import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { LocationPickerView } from '@/components/location-picker-view';
import { usePickerStore } from '@/lib/location-picker-store';

/* eslint-disable react/display-name */
const { back } = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock('expo-router', async () => {
  const React = await import('react');
  const Stack: any = () => null;
  Stack.Header = () => null;
  Stack.SearchBar = ({
    placeholder,
    onChangeText,
  }: {
    placeholder?: string;
    onChangeText?: (e: { nativeEvent: { text: string } }) => void;
  }) =>
    React.createElement('input', {
      placeholder,
      'aria-label': placeholder,
      onChange: (e: { target: { value: string } }) =>
        onChangeText?.({ nativeEvent: { text: e.target.value } }),
    });
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
      children ?? accessibilityLabel,
    );
  Stack.Toolbar.SearchBarSlot = () => null;
  Stack.Toolbar.Spacer = () => null;
  return { Stack, router: { back } };
});
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
}));

const PIKE_FEATURE = {
  geometry: { coordinates: [-122.3422, 47.6097] },
  properties: { name: 'Pike Place Market', city: 'Seattle', country: 'US' },
};
const ADDRESS_FEATURE = {
  geometry: { coordinates: [-122.42, 37.77] },
  properties: { housenumber: '123', street: 'Main Street', city: 'Springfield' },
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

function type(value: string) {
  fireEvent.change(screen.getByLabelText('Search or paste a location'), { target: { value } });
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

describe('LocationPickerView', () => {
  it('resolves a typed street address into a selectable result with coordinates', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([ADDRESS_FEATURE]));
    const onConfirm = vi.fn();
    usePickerStore.getState().begin(onConfirm);
    render(<LocationPickerView trip={null} />);

    type('123 Main Street');
    await flushDebounce();

    // The bare street address surfaces titled by its street line, not dropped.
    expect(screen.getByText('123 Main Street')).toBeInTheDocument();
    expect(screen.getByText('Springfield')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(onConfirm).toHaveBeenCalledWith({
      address: '123 Main Street',
      lat: 37.77,
      lng: -122.42,
    });
    expect(back).toHaveBeenCalled();
  });

  it('disables Select until a result is chosen', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([PIKE_FEATURE]));
    usePickerStore.getState().begin(() => {});
    render(<LocationPickerView trip={null} />);

    expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();

    type('pike');
    await flushDebounce();
    // First result auto-selects on arrival, so Select arms without an extra tap.
    expect(screen.getByRole('button', { name: 'Select' })).not.toBeDisabled();
  });

  it('Cancel leaves the editor location untouched', () => {
    const onConfirm = vi.fn();
    usePickerStore.getState().begin(onConfirm);
    render(<LocationPickerView trip={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(back).toHaveBeenCalled();
  });

  it('the pin button toggles pin mode, hiding the result list', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([PIKE_FEATURE]));
    usePickerStore.getState().begin(() => {});
    render(<LocationPickerView trip={null} />);

    type('pike');
    await flushDebounce();
    expect(screen.getByText('Pike Place Market')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Drop a pin' }));
    // In pin mode the list is hidden so the map fills the screen for a dropped pin.
    expect(screen.queryByText('Pike Place Market')).not.toBeInTheDocument();
  });
});
