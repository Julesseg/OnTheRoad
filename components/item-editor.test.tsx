import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ItemEditor } from '@/components/item-editor';
import type { Item } from '@/lib/schema';

// The native SwiftUI pickers are native-only. Capture each row's props — DatePickers
// keyed by title, wheel Pickers keyed by label — so specs can drive a selection the
// way a tap on the wheel would and assert which value each row is bound to.
const dpickers = vi.hoisted(
  () => ({}) as Record<string, { onDateChange?: (d: Date) => void; selection?: Date }>,
);
const pickers = vi.hoisted(
  () => ({}) as Record<string, { onSelectionChange?: (v: unknown) => void; selection?: unknown }>,
);

/* eslint-disable react/display-name -- inline passthrough stand-ins for native views */
vi.mock('@expo/ui/swift-ui', async () => {
  const React = await import('react');
  const pass =
    (t: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement(t, null, children);
  return {
    Host: pass('div'),
    Form: pass('div'),
    VStack: pass('div'),
    HStack: pass('div'),
    Image: () => null,
    // Render header + footer so the identity label and inline errors are queryable.
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
    TextField: ({
      text,
      placeholder,
      onTextChange,
    }: {
      text?: { value: string };
      placeholder?: string;
      onTextChange?: (t: string) => void;
    }) =>
      React.createElement('input', {
        placeholder,
        'aria-label': placeholder,
        defaultValue: text?.value,
        onChange: (e: { target: { value: string } }) => onTextChange?.(e.target.value),
      }),
    DatePicker: (props: { title?: string; onDateChange?: (d: Date) => void; selection?: Date }) => {
      if (props.title) dpickers[props.title] = { onDateChange: props.onDateChange, selection: props.selection };
      return null;
    },
    Picker: (props: {
      label?: string;
      onSelectionChange?: (v: unknown) => void;
      selection?: unknown;
      children?: React.ReactNode;
    }) => {
      if (props.label) pickers[props.label] = { onSelectionChange: props.onSelectionChange, selection: props.selection };
      return null;
    },
    Button: ({ label, onPress }: { label?: string; onPress?: () => void }) =>
      typeof label === 'string'
        ? React.createElement('button', { onClick: onPress, 'aria-label': label }, label)
        : null,
  };
});
vi.mock('@expo/ui/swift-ui/modifiers', () => ({
  font: vi.fn(() => ({})),
  foregroundStyle: vi.fn(() => ({})),
  datePickerStyle: vi.fn(() => ({})),
  pickerStyle: vi.fn(() => ({})),
  tag: vi.fn(() => ({})),
}));

// The editor drives Cancel/Save through expo-router's native Stack toolbar.
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
  }) => React.createElement('button', { onClick: onPress, 'aria-label': accessibilityLabel }, children);
  return { Stack };
});

beforeEach(() => {
  for (const k of Object.keys(dpickers)) delete dpickers[k];
  for (const k of Object.keys(pickers)) delete pickers[k];
});

afterEach(() => vi.restoreAllMocks());

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
}

describe('ItemEditor', () => {
  it('renders fields appropriate to a location, headed by its identity label', () => {
    render(<ItemEditor type="location" itemId="x" onSubmit={() => {}} />);
    expect(screen.getByText('Place')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('What is it?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Street, city, or landmark')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set on map' })).toBeInTheDocument();
  });

  it('renders only a note field for a note', () => {
    render(<ItemEditor type="note" itemId="x" onSubmit={() => {}} />);
    expect(screen.queryByPlaceholderText('What is it?')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Anything to remember')).toBeInTheDocument();
  });

  it('shows a required error in the section footer and does not submit when name is empty', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor type="location" itemId="x" onSubmit={onSubmit} />);
    save();
    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a built item when valid', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor type="location" itemId="loc-1" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Pier' } });
    fireEvent.change(screen.getByPlaceholderText('Street, city, or landmark'), {
      target: { value: '1 Quay' },
    });
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ type: 'location', id: 'loc-1', name: 'Pier', address: '1 Quay' }),
    );
  });

  it('sets a time through the native picker and persists it', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor type="location" itemId="loc-t" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Pier' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add time' }));
    const picked = new Date();
    picked.setHours(14, 30, 0, 0);
    dpickers['Time'].onDateChange!(picked);

    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ type: 'location', id: 'loc-t', name: 'Pier', time: '14:30' }),
    );
  });

  it('clears a set time back to unset, persisting "not set"', async () => {
    const onSubmit = vi.fn();
    const initial: Item = { type: 'location', id: 'loc-c', name: 'Pier', time: '08:00' };
    render(<ItemEditor type="location" itemId="loc-c" initialItem={initial} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear time' }));
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ type: 'location', id: 'loc-c', name: 'Pier' }),
    );
  });

  it('displays an existing duration on the h/m wheel (90 → 1h 30m) and round-trips it unchanged', async () => {
    const onSubmit = vi.fn();
    const initial: Item = { type: 'activity', id: 'act-1', name: 'Hike', duration: 90 };
    render(<ItemEditor type="activity" itemId="act-1" initialItem={initial} onSubmit={onSubmit} />);

    expect(pickers['Hours'].selection).toBe(1);
    expect(pickers['Minutes'].selection).toBe(30);

    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ type: 'activity', id: 'act-1', name: 'Hike', duration: 90 }),
    );
  });

  it('saves a duration changed on the wheel as total whole minutes', async () => {
    const onSubmit = vi.fn();
    const initial: Item = { type: 'activity', id: 'act-2', name: 'Hike', duration: 90 };
    render(<ItemEditor type="activity" itemId="act-2" initialItem={initial} onSubmit={onSubmit} />);

    pickers['Hours'].onSelectionChange!(2);
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ type: 'activity', id: 'act-2', name: 'Hike', duration: 150 }),
    );
  });

  it('clears a duration back to unset', async () => {
    const onSubmit = vi.fn();
    const initial: Item = { type: 'activity', id: 'act-3', name: 'Hike', duration: 90 };
    render(<ItemEditor type="activity" itemId="act-3" initialItem={initial} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear duration' }));
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ type: 'activity', id: 'act-3', name: 'Hike' }),
    );
  });

  it('attaches coords picked from a pasted URL to the saved item', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor type="location" itemId="loc-2" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Market' } });

    fireEvent.click(screen.getByRole('button', { name: 'Set on map' }));
    fireEvent.change(screen.getByLabelText('Maps URL or coordinates'), {
      target: { value: 'maps://?ll=47.6062,-122.3321' },
    });
    fireEvent.click(screen.getByLabelText('Parse'));
    await screen.findByText('47.6062, -122.3321');
    fireEvent.click(screen.getByLabelText('Use these coordinates'));

    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        type: 'location',
        id: 'loc-2',
        name: 'Market',
        lat: 47.6062,
        lng: -122.3321,
      }),
    );
  });

  it('fills an empty address from a Photon search result', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { coordinates: [-122.3422, 47.6097] },
            properties: { name: 'Pike Place Market', city: 'Seattle' },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const onSubmit = vi.fn();
    render(<ItemEditor type="location" itemId="loc-3" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Stop' } });

    fireEvent.click(screen.getByRole('button', { name: 'Set on map' }));
    fireEvent.click(screen.getByText('Search'));
    fireEvent.change(screen.getByLabelText('Search for a place'), { target: { value: 'pike' } });
    vi.advanceTimersByTime(260);
    fireEvent.click(await screen.findByText('Pike Place Market'));

    vi.useRealTimers();
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        type: 'location',
        id: 'loc-3',
        name: 'Stop',
        address: 'Seattle',
        lat: 47.6097,
        lng: -122.3422,
      }),
    );
  });

  it('invokes onDelete from the destructive section when editing an existing item', () => {
    const onDelete = vi.fn();
    render(
      <ItemEditor
        type="note"
        itemId="n1"
        initialItem={{ type: 'note', id: 'n1', text: 'hi' }}
        onSubmit={() => {}}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('omits the Delete control when creating a new item', () => {
    render(<ItemEditor type="note" itemId="n2" onSubmit={() => {}} onDelete={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
