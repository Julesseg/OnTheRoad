import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ItemEditor } from '@/components/item-editor';
import { getLocationPickSession, endLocationPick } from '@/lib/location-picker-session';
import type { Item } from '@/lib/schema';

// Capture DatePicker props keyed by title, and Picker props keyed by label.
const dpickers = vi.hoisted(
  () =>
    ({}) as Record<
      string,
      { onDateChange?: (d: Date) => void; selection?: Date; range?: { start?: Date; end?: Date } }
    >,
);
const pickers = vi.hoisted(
  () => ({}) as Record<string, { onSelectionChange?: (v: unknown) => void; selection?: unknown }>,
);

const routerMock = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn() }));

// Capture the checklist List.ForEach handlers so tests can drive the system
// swipe-to-delete (onDelete) and drag-to-reorder (onMove) callbacks.
const forEachHandlers = vi.hoisted(
  () =>
    ({}) as {
      onDelete?: (indices: number[]) => void;
      onMove?: (sourceIndices: number[], destination: number) => void;
    },
);

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
    VStack: pass('div'),
    HStack: pass('div'),
    LabeledContent: pass('div'),
    Divider: () => null,
    // Images carrying an onTapGesture modifier (the checklist circles) render
    // as buttons so taps and the shown symbol stay assertable.
    Image: ({
      systemName,
      modifiers,
    }: {
      systemName?: string;
      modifiers?: Record<string, unknown>[];
    }) => {
      const a11y = modifiers?.find((m) => m && '__accessibilityLabel' in m)?.__accessibilityLabel;
      const onTap = modifiers?.find((m) => m && '__onTap' in m)?.__onTap;
      if (!onTap) return null;
      return React.createElement('button', {
        'data-system-image': systemName,
        'aria-label': a11y,
        onClick: onTap,
      });
    },
    List: Object.assign(pass('div'), {
      ForEach: ({
        children,
        onDelete,
        onMove,
      }: {
        children?: React.ReactNode;
        onDelete?: (indices: number[]) => void;
        onMove?: (sourceIndices: number[], destination: number) => void;
      }) => {
        forEachHandlers.onDelete = onDelete;
        forEachHandlers.onMove = onMove;
        return React.createElement('div', null, children);
      },
    }),
    Section: ({
      children,
      header,
      footer,
    }: {
      children?: React.ReactNode;
      header?: React.ReactNode;
      footer?: React.ReactNode;
    }) => React.createElement('div', null, header, children, footer),
    // Text carrying an onTapGesture modifier (the location label) renders as
    // a button so taps stay assertable; plain Text stays a span.
    Text: ({
      children,
      modifiers,
    }: {
      children?: React.ReactNode;
      modifiers?: Record<string, unknown>[];
    }) => {
      const onTap = modifiers?.find((m) => m && '__onTap' in m)?.__onTap as (() => void) | undefined;
      if (onTap) return React.createElement('button', { onClick: onTap }, children);
      return React.createElement('span', null, children);
    },
    useNativeState: (initial: string) => ({ value: initial }),
    TextField: React.forwardRef(
      (
        {
          text,
          placeholder,
          onTextChange,
        }: { text?: { value: string }; placeholder?: string; onTextChange?: (t: string) => void },
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
        });
      },
    ),
    DatePicker: (props: {
      title?: string;
      onDateChange?: (d: Date) => void;
      selection?: Date;
      range?: { start?: Date; end?: Date };
    }) => {
      if (props.title)
        dpickers[props.title] = {
          onDateChange: props.onDateChange,
          selection: props.selection,
          range: props.range,
        };
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
    Button: ({
      label,
      onPress,
      modifiers,
    }: {
      label?: string;
      onPress?: () => void;
      modifiers?: { __accessibilityLabel?: string }[];
    }) => {
      const a11y = modifiers?.find((m) => m && '__accessibilityLabel' in m)?.__accessibilityLabel;
      return typeof label === 'string'
        ? React.createElement('button', { onClick: onPress, 'aria-label': a11y ?? label }, label)
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
  buttonStyle: vi.fn(() => ({})),
  lineLimit: vi.fn(() => ({})),
  truncationMode: vi.fn(() => ({})),
  listRowInsets: vi.fn(() => ({})),
  listRowSeparator: vi.fn(() => ({})),
  padding: vi.fn(() => ({})),
  frame: vi.fn(() => ({})),
  tint: vi.fn(() => ({})),
  onTapGesture: (fn: () => void) => ({ __onTap: fn }),
  accessibilityLabel: (label: string) => ({ __accessibilityLabel: label }),
  contentTransition: vi.fn(() => ({})),
  animation: vi.fn(() => ({})),
  Animation: { default: {} },
}));

vi.mock('expo-symbols', () => ({ SymbolView: () => null }));

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
  return { Stack, router: routerMock };
});

beforeEach(() => {
  for (const k of Object.keys(dpickers)) delete dpickers[k];
  for (const k of Object.keys(pickers)) delete pickers[k];
  delete forEachHandlers.onDelete;
  delete forEachHandlers.onMove;
  routerMock.push.mockClear();
  routerMock.back.mockClear();
  endLocationPick();
});
afterEach(() => vi.restoreAllMocks());

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
}

describe('ItemEditor', () => {
  const TRIP = { startDate: '2025-06-01', endDate: '2025-06-07' };
  const INIT_DATE = '2025-06-03';

  it('renders name and notes fields for a new item', () => {
    render(<ItemEditor itemId="x" onSubmit={() => {}} />);
    expect(screen.getByPlaceholderText('What is it?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Anything else to remember')).toBeInTheDocument();
  });

  it('renders a category picker defaulting to "activity"', () => {
    render(<ItemEditor itemId="x" onSubmit={() => {}} />);
    expect(pickers['Category']).toBeDefined();
    expect(pickers['Category'].selection).toBe('activity');
  });

  it('sheet title reflects the currently selected category', () => {
    render(<ItemEditor itemId="x" onSubmit={() => {}} />);
    expect(screen.getByText('New Activity')).toBeInTheDocument();
    act(() => pickers['Category'].onSelectionChange!('stay'));
    expect(screen.getByText('New Stay')).toBeInTheDocument();
  });

  it('shows a required error in the section footer and does not submit when name is empty', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="x" onSubmit={onSubmit} />);
    save();
    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a built item with the selected category when name is filled', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="act-1" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Whale watching' } });
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ id: 'act-1', name: 'Whale watching', category: 'activity' }, INIT_DATE),
    );
  });

  it('submits with a different category when changed via picker', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="meal-1" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Taco truck' } });
    act(() => pickers['Category'].onSelectionChange!('meal'));
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ id: 'meal-1', name: 'Taco truck', category: 'meal' }, INIT_DATE),
    );
  });

  it('sets a time through the native picker and persists it', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="act-t" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Hike' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add time' }));
    const picked = new Date();
    picked.setHours(9, 30, 0, 0);
    act(() => dpickers['Time'].onDateChange!(picked));

    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { id: 'act-t', name: 'Hike', category: 'activity', time: '09:30' },
        INIT_DATE,
      ),
    );
  });

  it('clears a set time back to unset', async () => {
    const onSubmit = vi.fn();
    const initial: Item = { id: 'act-c', name: 'Hike', category: 'activity', time: '08:00' };
    render(<ItemEditor itemId="act-c" initialItem={initial} trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear time' }));
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ id: 'act-c', name: 'Hike', category: 'activity' }, INIT_DATE),
    );
  });

  it('pre-fills name and category when editing an existing item', () => {
    const initial: Item = { id: 'stay-1', name: 'Sea Cliff Inn', category: 'stay' };
    render(<ItemEditor itemId="stay-1" initialItem={initial} onSubmit={() => {}} />);
    const nameInput = screen.getByPlaceholderText('What is it?') as HTMLInputElement;
    expect(nameInput.defaultValue).toBe('Sea Cliff Inn');
    expect(pickers['Category'].selection).toBe('stay');
  });

  it('invokes onDelete when the Delete button is clicked while editing an existing item', () => {
    const onDelete = vi.fn();
    const initial: Item = { id: 'x', name: 'Walk', category: 'activity' };
    render(<ItemEditor itemId="x" initialItem={initial} onSubmit={() => {}} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('omits the Delete control when creating a new item', () => {
    render(<ItemEditor itemId="x" onSubmit={() => {}} onDelete={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('surfaces tappable links found in the notes field', () => {
    const initial: Item = { id: 'a', name: 'Hike', category: 'activity', notes: 'trailhead https://example.com' };
    render(<ItemEditor itemId="a" initialItem={initial} onSubmit={() => {}} />);
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  // --- Date picker (issue #75) ---

  it('renders a date picker with selection matching initialDate', () => {
    render(<ItemEditor itemId="x" trip={TRIP} initialDate={INIT_DATE} onSubmit={() => {}} />);
    expect(dpickers['Date']).toBeDefined();
    const sel = dpickers['Date'].selection!;
    expect(sel.getFullYear()).toBe(2025);
    expect(sel.getMonth()).toBe(5); // 0-based June
    expect(sel.getDate()).toBe(3);
  });

  it('saving with unchanged date passes initialDate as second arg to onSubmit', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="d-1" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Boat tour' } });
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { id: 'd-1', name: 'Boat tour', category: 'activity' },
        INIT_DATE,
      ),
    );
  });

  it('changing the date picker fires onSubmit with the new YYYY-MM-DD string', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="d-2" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Swim' } });
    const picked = new Date(2025, 5, 5, 12, 0, 0); // June 5 local
    act(() => dpickers['Date'].onDateChange!(picked));
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { id: 'd-2', name: 'Swim', category: 'activity' },
        '2025-06-05',
      ),
    );
  });

  it('date picker range is clamped to trip startDate and endDate', () => {
    render(<ItemEditor itemId="x" trip={TRIP} initialDate={INIT_DATE} onSubmit={() => {}} />);
    const { range } = dpickers['Date'];
    expect(range).toBeDefined();
    expect(range!.start!.getFullYear()).toBe(2025);
    expect(range!.start!.getMonth()).toBe(5);
    expect(range!.start!.getDate()).toBe(1);
    expect(range!.end!.getFullYear()).toBe(2025);
    expect(range!.end!.getMonth()).toBe(5);
    expect(range!.end!.getDate()).toBe(7);
  });

  // --- Location field (issue #76) ---

  it('shows an "Add location" button when the item has no location', () => {
    render(<ItemEditor itemId="x" onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Add location' })).toBeInTheDocument();
  });

  it('shows the address in the location row when item has location.address', () => {
    const initial: Item = { id: 'x', name: 'Hike', category: 'activity', location: { address: 'Santorini' } };
    render(<ItemEditor itemId="x" initialItem={initial} onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Santorini' })).toBeInTheDocument();
  });

  it('shows lat,lng in the location row when item has only coords', () => {
    const initial: Item = { id: 'x', name: 'Hike', category: 'activity', location: { lat: 36.39, lng: 25.46 } };
    render(<ItemEditor itemId="x" initialItem={initial} onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: '36.39, 25.46' })).toBeInTheDocument();
  });

  it('clear button removes location; saved item omits location field', async () => {
    const onSubmit = vi.fn();
    const initial: Item = { id: 'loc-1', name: 'Hotel', category: 'stay', location: { address: 'Santorini' } };
    render(<ItemEditor itemId="loc-1" initialItem={initial} trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear location' }));
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ id: 'loc-1', name: 'Hotel', category: 'stay' }, INIT_DATE),
    );
  });

  it('tapping the location row opens the picker sheet with the current location', () => {
    const initial: Item = { id: 'x', name: 'Hike', category: 'activity', location: { address: 'Santorini' } };
    render(<ItemEditor itemId="x" initialItem={initial} onSubmit={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Santorini' }));

    expect(routerMock.push).toHaveBeenCalledWith('/trip/location-picker');
    expect(getLocationPickSession()?.initialLocation).toEqual({ address: 'Santorini' });
  });

  // --- Checklist section (issue #77) ---

  it('shows existing checklist entries as editable fields in the Checklist section', () => {
    const initial: Item = {
      id: 'x', name: 'Pack bags', category: 'activity',
      checklist: [
        { id: 'c1', label: 'Passport', checked: false },
        { id: 'c2', label: 'Sunscreen', checked: true },
      ],
    };
    render(<ItemEditor itemId="x" initialItem={initial} onSubmit={() => {}} />);
    expect(screen.getByText('Checklist')).toBeInTheDocument();
    const fields = screen.getAllByPlaceholderText('Checklist entry') as HTMLInputElement[];
    expect(fields.map((f) => f.defaultValue)).toEqual(['Passport', 'Sunscreen']);
  });

  it('adds a checklist entry and includes it on save, unchecked with a fresh id', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="cl-1" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Pack bags' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    fireEvent.change(screen.getByPlaceholderText('Checklist entry'), { target: { value: 'Passport' } });

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const item = onSubmit.mock.calls[0][0] as Item;
    expect(item.checklist).toHaveLength(1);
    expect(item.checklist![0]).toMatchObject({ label: 'Passport', checked: false });
    expect(item.checklist![0].id).toBeTruthy();
  });

  const PACK_ITEM: Item = {
    id: 'cl-2', name: 'Pack bags', category: 'activity',
    checklist: [
      { id: 'c1', label: 'Passport', checked: true },
      { id: 'c2', label: 'Sunscreen', checked: false },
    ],
  };

  it('renames an entry on save, preserving its id and checked state', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="cl-2" initialItem={PACK_ITEM} trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    const fields = screen.getAllByPlaceholderText('Checklist entry');
    fireEvent.change(fields[0], { target: { value: 'Passport + visa' } });

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect((onSubmit.mock.calls[0][0] as Item).checklist).toEqual([
      { id: 'c1', label: 'Passport + visa', checked: true },
      { id: 'c2', label: 'Sunscreen', checked: false },
    ]);
  });

  it('removes an entry via system swipe-to-delete and saves', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="cl-2" initialItem={PACK_ITEM} trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    act(() => forEachHandlers.onDelete!([0]));

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect((onSubmit.mock.calls[0][0] as Item).checklist).toEqual([
      { id: 'c2', label: 'Sunscreen', checked: false },
    ]);
  });

  it('removing the last entry drops the checklist field entirely', async () => {
    const onSubmit = vi.fn();
    const oneEntry: Item = {
      id: 'cl-3', name: 'Pack', category: 'activity',
      checklist: [{ id: 'c1', label: 'Passport', checked: false }],
    };
    render(<ItemEditor itemId="cl-3" initialItem={oneEntry} trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    act(() => forEachHandlers.onDelete!([0]));

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect('checklist' in (onSubmit.mock.calls[0][0] as Item)).toBe(false);
  });

  it('reorders entries via drag (onMove) and saves the new order', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="cl-2" initialItem={PACK_ITEM} trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    act(() => forEachHandlers.onMove!([1], 0));

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect((onSubmit.mock.calls[0][0] as Item).checklist!.map((e) => e.label)).toEqual([
      'Sunscreen',
      'Passport',
    ]);
  });

  it('renders a circle per entry and tapping it toggles checked state on save', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="cl-2" initialItem={PACK_ITEM} trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    expect(screen.getByRole('button', { name: 'Toggle entry 1' })).toHaveAttribute(
      'data-system-image',
      'checkmark.circle.fill',
    );
    expect(screen.getByRole('button', { name: 'Toggle entry 2' })).toHaveAttribute(
      'data-system-image',
      'circle',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toggle entry 2' }));

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect((onSubmit.mock.calls[0][0] as Item).checklist).toEqual([
      { id: 'c1', label: 'Passport', checked: true },
      { id: 'c2', label: 'Sunscreen', checked: true },
    ]);
  });

  it('drops entries left blank instead of saving them', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="cl-4" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Pack bags' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    const fields = screen.getAllByPlaceholderText('Checklist entry');
    fireEvent.change(fields[0], { target: { value: '  Passport  ' } });
    // second entry stays blank

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const item = onSubmit.mock.calls[0][0] as Item;
    expect(item.checklist).toHaveLength(1);
    expect(item.checklist![0]).toMatchObject({ label: 'Passport', checked: false });
  });

  it('location set via picker is included in the submitted item', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="loc-2" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Caldera view' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
    // The picker sheet lives on its own route; the editor hands it a session.
    const session = getLocationPickSession();
    expect(session).not.toBeNull();
    act(() => session!.onConfirm({ address: 'Santorini', lat: 36.39, lng: 25.46 }));

    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        {
          id: 'loc-2',
          name: 'Caldera view',
          category: 'activity',
          location: { address: 'Santorini', lat: 36.39, lng: 25.46 },
        },
        INIT_DATE,
      ),
    );
  });
});
