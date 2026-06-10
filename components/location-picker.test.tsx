import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { LocationPicker } from '@/components/location-picker';

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
    RNHostView: ({ children }: { children?: React.ReactNode }) => children,
    Spacer: () => null,
    VStack: pass('div'),
    HStack: pass('div'),
    LabeledContent: pass('div'),
    Divider: () => null,
    Image: () => null,
    Section: ({
      children,
      header,
      footer,
    }: {
      children?: React.ReactNode;
      header?: React.ReactNode;
      footer?: React.ReactNode;
    }) => React.createElement('div', null, header, children, footer),
    Text: pass('span'),
    useNativeState: (initial: string) => ({ value: initial }),
    TextField: React.forwardRef(
      (
        {
          text,
          placeholder,
          onTextChange,
          onFocusChange,
        }: {
          text?: { value: string };
          placeholder?: string;
          onTextChange?: (t: string) => void;
          onFocusChange?: (focused: boolean) => void;
        },
        ref: React.Ref<{ setText: (t: string) => void }>,
      ) => {
        const inputRef = React.useRef<HTMLInputElement>(null);
        React.useImperativeHandle(ref, () => ({
          setText: (t: string) => {
            if (inputRef.current) inputRef.current.value = t;
          },
        }));
        return React.createElement('input', {
          ref: inputRef,
          placeholder,
          'aria-label': placeholder,
          defaultValue: text?.value,
          onChange: (e: { target: { value: string } }) => onTextChange?.(e.target.value),
          onFocus: () => onFocusChange?.(true),
          onBlur: () => onFocusChange?.(false),
        });
      },
    ),
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
        ? React.createElement(
            'button',
            { onClick: onPress, 'aria-label': a11y },
            children ?? label,
          )
        : null;
    },
  };
});
vi.mock('@expo/ui/swift-ui/modifiers', () => ({
  font: vi.fn(() => ({})),
  foregroundStyle: vi.fn(() => ({})),
  datePickerStyle: vi.fn(() => ({})),
  pickerStyle: vi.fn(() => ({})),
  tag: vi.fn(() => ({})),
  labelsHidden: vi.fn(() => ({})),
  multilineTextAlignment: vi.fn(() => ({})),
  background: vi.fn(() => ({})),
  animation: vi.fn(() => ({})),
  Animation: { default: {}, spring: vi.fn(() => ({})) },
  buttonStyle: vi.fn(() => ({})),
  clipShape: vi.fn(() => ({})),
  contentTransition: vi.fn(() => ({})),
  listRowBackground: vi.fn(() => ({})),
  listRowInsets: vi.fn(() => ({})),
  listRowSeparator: vi.fn(() => ({})),
  frame: vi.fn(() => ({})),
  tint: vi.fn(() => ({})),
  onTapGesture: vi.fn(() => ({})),
  accessibilityLabel: (label: string) => ({ __accessibilityLabel: label }),
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  const Stack: any = () => null;
  Stack.Header = () => null;
  Stack.Title = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children);
  Stack.Toolbar = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  Stack.Toolbar.Button = ({
    children,
    onPress,
    accessibilityLabel,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
  }) =>
    React.createElement(
      'button',
      { onClick: onPress, 'aria-label': accessibilityLabel },
      children,
    );
  return { Stack };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function flushDebounce(ms = 250) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await act(async () => {});
}

function photonFetchReturning(features: unknown[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ features }),
  });
}

const PIKE_FEATURE = {
  geometry: { coordinates: [-122.3422, 47.6097] },
  properties: { name: 'Pike Place Market', city: 'Seattle', country: 'US' },
};

describe('LocationPicker', () => {
  it('calls onCancel when the Cancel button is tapped', () => {
    const onCancel = vi.fn();
    render(<LocationPicker onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('first row for a lat,lng input confirms with coords-only location', async () => {
    const onConfirm = vi.fn();
    render(<LocationPicker onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('Search or paste a location'), {
      target: { value: '48.85, 2.35' },
    });
    fireEvent.click(screen.getByRole('button', { name: /use.*coordinates/i }));
    expect(onConfirm).toHaveBeenCalledWith({ lat: 48.85, lng: 2.35 });
  });

  it('first row for a maps URL resolves and confirms with coords-only location', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        url: 'https://www.google.com/maps/place/X/@47.61,-122.34,17z/data=!3d47.6097!4d-122.3422',
        text: async () => '',
      }),
    );
    const onConfirm = vi.fn();
    render(<LocationPicker onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('Search or paste a location'), {
      target: { value: 'https://maps.app.goo.gl/abc123' },
    });

    const btn = await screen.findByRole('button', { name: /use.*coordinates/i });
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledWith({ lat: 47.6097, lng: -122.3422 });
  });

  it('first row for free text confirms with address-only location', () => {
    const onConfirm = vi.fn();
    render(<LocationPicker onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('Search or paste a location'), {
      target: { value: 'Paris, France' },
    });
    fireEvent.click(screen.getByRole('button', { name: /use.*plain address/i }));
    expect(onConfirm).toHaveBeenCalledWith({ address: 'Paris, France' });
  });

  it('Photon results appear after debounce and tapping one confirms with address+coords', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([PIKE_FEATURE]));
    const onConfirm = vi.fn();
    render(<LocationPicker onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('Search or paste a location'), {
      target: { value: 'pike place' },
    });
    await flushDebounce();

    // Each result shows its address as a distinguishing subtitle.
    expect(screen.getByText('Seattle, US')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /pike place market/i }));
    expect(onConfirm).toHaveBeenCalledWith({
      address: 'Pike Place Market',
      lat: 47.6097,
      lng: -122.3422,
    });
  });

  it('aborts in-flight Photon request when query changes', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<{ ok: true; json: () => Promise<unknown> }>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<LocationPicker onConfirm={() => {}} />);
    fireEvent.change(screen.getByLabelText('Search or paste a location'), {
      target: { value: 'pike' },
    });
    await flushDebounce();
    const firstSignal = (fetchMock.mock.calls[0][1] as RequestInit).signal!;
    expect(firstSignal.aborted).toBe(false);

    fireEvent.change(screen.getByLabelText('Search or paste a location'), {
      target: { value: 'pike place' },
    });
    await flushDebounce();
    expect(firstSignal.aborted).toBe(true);
  });

  it('focusing the search field collapses the map', async () => {
    render(<LocationPicker onConfirm={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /drop a pin/i }));
    await screen.findByTestId('apple-maps-view');

    fireEvent.focus(screen.getByLabelText('Search or paste a location'));
    expect(screen.queryByTestId('apple-maps-view')).not.toBeInTheDocument();
  });

  it('shows the map drop-pin affordance and confirming a dropped pin returns coords', async () => {
    const onConfirm = vi.fn();
    render(<LocationPicker onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: /drop a pin/i }));
    const map = await screen.findByTestId('apple-maps-view');
    fireEvent.click(map, { clientX: 48.85, clientY: 2.35 });
    fireEvent.click(screen.getByRole('button', { name: /use pin/i }));
    expect(onConfirm).toHaveBeenCalledWith({ lat: 48.85, lng: 2.35 });
  });
});
