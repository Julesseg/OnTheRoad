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
    Button: ({
      label,
      children,
      onPress,
    }: {
      label?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      typeof label === 'string' || children
        ? React.createElement('button', { onClick: onPress }, children ?? label)
        : null,
  };
});
vi.mock('@expo/ui/swift-ui/modifiers', () => ({
  font: vi.fn(() => ({})),
  foregroundStyle: vi.fn(() => ({})),
  background: vi.fn(() => ({})),
  listRowBackground: vi.fn(() => ({})),
  scrollContentBackground: vi.fn(() => ({})),
  tint: vi.fn(() => ({})),
}));

const { back, setOptions, detentListeners } = vi.hoisted(() => ({
  back: vi.fn(),
  setOptions: vi.fn(),
  detentListeners: [] as Array<(e: { data: { index: number; stable: boolean } }) => void>,
}));
function emitDetent(index: number, stable = true) {
  act(() => detentListeners.forEach((l) => l({ data: { index, stable } })));
}
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
  return {
    Stack,
    router: { back },
    useNavigation: () => ({
      setOptions,
      addListener: (type: string, cb: (e: { data: { index: number; stable: boolean } }) => void) => {
        if (type === 'sheetDetentChange') detentListeners.push(cb);
        return () => {
          const i = detentListeners.indexOf(cb);
          if (i >= 0) detentListeners.splice(i, 1);
        };
      },
    }),
  };
});

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
  setOptions.mockClear();
  detentListeners.length = 0;
  usePickerStore.getState().end();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('LocationSearchSheet', () => {
  it('commits a typed street address to the editor when its result row is tapped', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([ADDRESS_FEATURE]));
    const onConfirm = vi.fn();
    usePickerStore.getState().begin(onConfirm);
    render(<LocationSearchSheet />);

    type('123 Main Street');
    await flushDebounce();

    // The bare street address surfaces titled by its street line, not dropped.
    expect(screen.getByText('123 Main Street')).toBeInTheDocument();
    expect(screen.getByText('Springfield')).toBeInTheDocument();

    // Tapping the result row is the commit in search mode.
    fireEvent.click(screen.getByText('123 Main Street'));
    expect(onConfirm).toHaveBeenCalledWith({ address: '123 Main Street', lat: 37.77, lng: -122.42 });
    expect(back).toHaveBeenCalled();
  });

  it('hides the abort Cancel once results are on screen so the list stays tappable', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([PIKE_FEATURE]));
    usePickerStore.getState().begin(() => {});
    render(<LocationSearchSheet />);

    // Empty state: a Cancel is available to abort the whole pick.
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    type('pike');
    await flushDebounce();
    expect(screen.getByText('Pike Place Market')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('empty-state Cancel aborts the pick without confirming', () => {
    const onConfirm = vi.fn();
    usePickerStore.getState().begin(onConfirm);
    render(<LocationSearchSheet />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(back).toHaveBeenCalled();
  });

  it('the pin button enters pin mode, hiding the result list', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([PIKE_FEATURE]));
    usePickerStore.getState().begin(() => {});
    render(<LocationSearchSheet />);

    type('pike');
    await flushDebounce();
    expect(screen.getByText('Pike Place Market')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Drop a pin' }));
    expect(screen.queryByText('Pike Place Market')).not.toBeInTheDocument();
    expect(usePickerStore.getState().state.mode).toBe('pin');
  });

  it('in pin mode Select is disabled until a pin is dropped, then commits its coords', () => {
    const onConfirm = vi.fn();
    usePickerStore.getState().begin(onConfirm);
    render(<LocationSearchSheet />);

    fireEvent.click(screen.getByRole('button', { name: 'Drop a pin' }));
    expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();

    act(() => usePickerStore.getState().dispatch({ type: 'dropPin', coords: { lat: 1.5, lng: 2.5 } }));
    const select = screen.getByRole('button', { name: 'Select' });
    expect(select).not.toBeDisabled();

    fireEvent.click(select);
    expect(onConfirm).toHaveBeenCalledWith({ lat: 1.5, lng: 2.5 });
    expect(back).toHaveBeenCalled();
  });

  it('in pin mode Cancel returns to search without aborting the pick', () => {
    const onConfirm = vi.fn();
    usePickerStore.getState().begin(onConfirm);
    render(<LocationSearchSheet />);

    fireEvent.click(screen.getByRole('button', { name: 'Drop a pin' }));
    expect(usePickerStore.getState().state.mode).toBe('pin');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(usePickerStore.getState().state.mode).toBe('search');
    expect(back).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a stable detent change drives the mode (drag in/out of pin mode)', () => {
    usePickerStore.getState().begin(() => {});
    render(<LocationSearchSheet />);

    emitDetent(0); // dragged to the small detent
    expect(usePickerStore.getState().state.mode).toBe('pin');

    emitDetent(1); // dragged back up
    expect(usePickerStore.getState().state.mode).toBe('search');
  });
});
