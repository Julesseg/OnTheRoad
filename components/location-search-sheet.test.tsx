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
  animation: vi.fn(() => ({})),
  Animation: { default: {} },
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
  Stack.SearchBar = React.forwardRef(
    (
      {
        placeholder,
        onChangeText,
      }: {
        placeholder?: string;
        onChangeText?: (e: { nativeEvent: { text: string } }) => void;
      },
      _ref: React.Ref<unknown>,
    ) =>
      React.createElement('input', {
        placeholder,
        'aria-label': placeholder,
        onChange: (e: { target: { value: string } }) =>
          onChangeText?.({ nativeEvent: { text: e.target.value } }),
      }),
  );
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
  it('tapping a result only selects it; Select commits the choice', async () => {
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

    // Tapping the row selects it but must NOT dismiss the picker.
    fireEvent.click(screen.getByText('123 Main Street'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();

    // Select is the explicit commit.
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(onConfirm).toHaveBeenCalledWith({ address: '123 Main Street', lat: 37.77, lng: -122.42 });
    expect(back).toHaveBeenCalled();
  });

  it('Cancel and Select stay visible while results are on screen', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([PIKE_FEATURE]));
    usePickerStore.getState().begin(() => {});
    render(<LocationSearchSheet />);

    type('pike');
    await flushDebounce();
    expect(screen.getByText('Pike Place Market')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
  });

  it('Cancel aborts the pick without confirming', () => {
    const onConfirm = vi.fn();
    usePickerStore.getState().begin(onConfirm);
    render(<LocationSearchSheet />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(back).toHaveBeenCalled();
  });

  it('Select is disabled until a result is chosen, then arms on auto-select', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([PIKE_FEATURE]));
    usePickerStore.getState().begin(() => {});
    render(<LocationSearchSheet />);

    expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();

    type('pike');
    await flushDebounce();
    expect(screen.getByRole('button', { name: 'Select' })).not.toBeDisabled();
  });

  it('has no pin-mode button; the search bar is always present', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([PIKE_FEATURE]));
    usePickerStore.getState().begin(() => {});
    render(<LocationSearchSheet />);

    // The dedicated pin button is gone; the search field stays on screen.
    expect(screen.queryByRole('button', { name: 'Drop a pin' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Search or paste a location')).toBeInTheDocument();

    type('pike');
    await flushDebounce();
    // Results still show, with the search field still there.
    expect(screen.getByText('Pike Place Market')).toBeInTheDocument();
    expect(screen.getByLabelText('Search or paste a location')).toBeInTheDocument();
  });

  it('a map tap leads the list with a coords pin that Select commits', () => {
    const onConfirm = vi.fn();
    usePickerStore.getState().begin(onConfirm);
    render(<LocationSearchSheet />);

    expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();

    act(() => usePickerStore.getState().dispatch({ type: 'mapTapped', coords: { lat: 1.5, lng: 2.5 } }));
    // The pin shows as a row labelled by its truncated coordinates, selected
    // (checkmark) and arming Select.
    expect(screen.getByText('1.500, 2.500')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
    const select = screen.getByRole('button', { name: 'Select' });
    expect(select).not.toBeDisabled();

    fireEvent.click(select);
    expect(onConfirm).toHaveBeenCalledWith({ lat: 1.5, lng: 2.5 });
    expect(back).toHaveBeenCalled();
  });

  it('selecting a search result removes the map-tapped pin row', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([PIKE_FEATURE]));
    usePickerStore.getState().begin(() => {});
    render(<LocationSearchSheet />);

    type('pike');
    await flushDebounce();
    act(() => usePickerStore.getState().dispatch({ type: 'mapTapped', coords: { lat: 1.5, lng: 2.5 } }));
    expect(screen.getByText('1.500, 2.500')).toBeInTheDocument();

    // Choosing another result drops the pin row.
    fireEvent.click(screen.getByText('Pike Place Market'));
    expect(screen.queryByText('1.500, 2.500')).not.toBeInTheDocument();
  });

  it('the peek detent surfaces the selected name as the title; the search detent clears it', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([PIKE_FEATURE]));
    usePickerStore.getState().begin(() => {});
    render(<LocationSearchSheet />);

    type('pike');
    await flushDebounce();

    emitDetent(0); // peek
    expect(setOptions).toHaveBeenLastCalledWith({ title: 'Pike Place Market' });

    emitDetent(1); // search
    expect(setOptions).toHaveBeenLastCalledWith({ title: '' });
  });

  it('hides the search bar at the peek detent and shows it again at the search detent', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([PIKE_FEATURE]));
    usePickerStore.getState().begin(() => {});
    render(<LocationSearchSheet />);

    type('pike');
    await flushDebounce();
    expect(screen.getByLabelText('Search or paste a location')).toBeInTheDocument();

    emitDetent(0); // peek — the title stands in, so the bar is hidden
    expect(screen.queryByLabelText('Search or paste a location')).not.toBeInTheDocument();
    // The query is retained in state while the bar is gone.
    expect(usePickerStore.getState().state.query).toBe('pike');

    emitDetent(1); // back to search — the bar reappears
    expect(screen.getByLabelText('Search or paste a location')).toBeInTheDocument();
  });
});
