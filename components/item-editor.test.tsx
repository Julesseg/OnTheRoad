import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ItemEditor } from '@/components/item-editor';
import { usePickerStore } from '@/lib/location-picker-store';
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
    // Mirrors the SwiftUI TextField closely enough to drive the checklist's
    // paragraph behavior: the native field always carries a leading zero-width
    // sentinel (kept out of the visible <input> value), Return inserts a newline
    // at the caret, and Backspace at offset 0 deletes the sentinel. Focus and
    // selection are exposed imperatively via the ref.
    TextField: React.forwardRef(
      (
        {
          text,
          placeholder,
          onTextChange,
          axis,
          autoFocus,
        }: {
          text?: { value: string };
          placeholder?: string;
          onTextChange?: (t: string) => void;
          axis?: string;
          autoFocus?: boolean;
        },
        ref: React.Ref<{
          setText: (t: string) => void;
          clear: () => void;
          focus: () => void;
          blur: () => void;
          setSelection: (start: number, end: number) => void;
        }>,
      ) => {
        const SENTINEL = '\u200B';
        // Only the checklist rows seed their native text with the sentinel; the
        // name/notes fields don't, and must pass their text through verbatim.
        const usesSentinel = (text?.value ?? '').startsWith(SENTINEL);
        const strip = (t: string) =>
          t.startsWith(SENTINEL) ? t.slice(SENTINEL.length) : t;
        const inputRef = React.useRef<HTMLInputElement>(null);
        React.useImperativeHandle(ref, () => ({
          setText: (t: string) => {
            if (inputRef.current) inputRef.current.value = strip(t);
          },
          clear: () => {
            if (inputRef.current) inputRef.current.value = '';
          },
          focus: () => inputRef.current?.focus(),
          blur: () => inputRef.current?.blur(),
          setSelection: (start: number, end: number) => {
            const el = inputRef.current;
            if (!el) return;
            // Native offsets include the sentinel; shift back to the visible value.
            const s = Math.max(0, start - SENTINEL.length);
            const e = Math.max(0, end - SENTINEL.length);
            el.setSelectionRange?.(s, e);
          },
        }));
        return React.createElement('input', {
          ref: inputRef,
          placeholder,
          'aria-label': placeholder,
          'data-axis': axis,
          autoFocus,
          defaultValue: strip(text?.value ?? ''),
          // A sentinel field keeps its leading sentinel through edits, so report
          // it back on every change; plain fields report their value verbatim.
          onChange: (e: { target: { value: string } }) =>
            onTextChange?.(usesSentinel ? SENTINEL + e.target.value : e.target.value),
          onKeyDown: (e: { key: string; currentTarget: HTMLInputElement }) => {
            if (!usesSentinel) return;
            const el = e.currentTarget;
            const val = el.value ?? '';
            if (e.key === 'Enter') {
              const pos = el.selectionStart ?? val.length;
              onTextChange?.(SENTINEL + val.slice(0, pos) + '\n' + val.slice(pos));
            } else if (e.key === 'Backspace') {
              const start = el.selectionStart ?? 0;
              const end = el.selectionEnd ?? start;
              // Caret at the very start: the keystroke lands on the sentinel.
              if (start === 0 && end === 0) onTextChange?.(val);
            }
          },
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
      // Render children so option labels (e.g. the trip selector's) stay queryable.
      return React.createElement('div', null, props.children);
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
  listRowBackground: vi.fn(() => ({})),
  scrollContentBackground: vi.fn(() => ({})),
  contentTransition: vi.fn(() => ({})),
  animation: vi.fn(() => ({})),
  Animation: { default: {} },
  submitLabel: vi.fn(() => ({})),
  onSubmit: (fn: () => void) => ({ __onSubmit: fn }),
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
  usePickerStore.getState().end();
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
    expect(screen.getByRole('button', { name: '36.390, 25.460' })).toBeInTheDocument();
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

  it('tapping the location row opens the picker, which begins blank (ADR-0012)', () => {
    const initial: Item = { id: 'x', name: 'Hike', category: 'activity', location: { address: 'Santorini' } };
    render(<ItemEditor itemId="x" initialItem={initial} onSubmit={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Santorini' }));

    expect(routerMock.push).toHaveBeenCalledWith('/trip/location-picker');
    // The picker no longer reads the item's current location — it opens blank.
    expect(usePickerStore.getState().state.query).toBe('');
    expect(usePickerStore.getState().onConfirm).not.toBeNull();
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

  it('focuses the entry it just added so the keyboard opens', () => {
    render(<ItemEditor itemId="cl-f" trip={TRIP} initialDate={INIT_DATE} onSubmit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(screen.getByPlaceholderText('Checklist entry')).toHaveFocus();
  });

  it('does not steal focus to existing entries when editing an item', () => {
    const initial: Item = {
      id: 'cl-nf', name: 'Pack', category: 'activity',
      checklist: [{ id: 'c1', label: 'Passport', checked: false }],
    };
    render(<ItemEditor itemId="cl-nf" initialItem={initial} onSubmit={() => {}} />);
    expect(screen.getByPlaceholderText('Checklist entry')).not.toHaveFocus();
  });

  it('hitting Return at the end of an entry adds a new blank entry to keep inputting', () => {
    render(<ItemEditor itemId="cl-r" trip={TRIP} initialDate={INIT_DATE} onSubmit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    fireEvent.change(screen.getByPlaceholderText('Checklist entry'), { target: { value: 'Passport' } });

    fireEvent.keyDown(screen.getByDisplayValue('Passport'), { key: 'Enter' });

    const fields = screen.getAllByPlaceholderText('Checklist entry') as HTMLInputElement[];
    expect(fields).toHaveLength(2);
    expect(fields[1].defaultValue).toBe('');
    // The new entry takes focus so typing continues without reaching for the row.
    expect(fields[1]).toHaveFocus();
  });

  it('inserts the new entry directly below the current one, not at the end', async () => {
    const onSubmit = vi.fn();
    const initial: Item = {
      id: 'cl-ins', name: 'Pack', category: 'activity',
      checklist: [
        { id: 'a', label: 'First', checked: false },
        { id: 'b', label: 'Last', checked: false },
      ],
    };
    render(<ItemEditor itemId="cl-ins" initialItem={initial} trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    // Return at the end of the *first* row drops a blank row between the two.
    const fields = screen.getAllByPlaceholderText('Checklist entry') as HTMLInputElement[];
    fields[0].setSelectionRange(fields[0].value.length, fields[0].value.length);
    fireEvent.keyDown(fields[0], { key: 'Enter' });
    const afterAdd = screen.getAllByPlaceholderText('Checklist entry') as HTMLInputElement[];
    fireEvent.change(afterAdd[1], { target: { value: 'Middle' } });

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect((onSubmit.mock.calls[0][0] as Item).checklist!.map((e) => e.label)).toEqual([
      'First',
      'Middle',
      'Last',
    ]);
  });

  it('Return keeps the current row’s text and adds a blank row below it (no split)', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="cl-add" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Pack' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    const field = screen.getByPlaceholderText('Checklist entry') as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'HelloWorld' } });
    field.setSelectionRange(5, 5); // caret mid-text — must NOT split the text
    fireEvent.keyDown(field, { key: 'Enter' });

    const fields = screen.getAllByPlaceholderText('Checklist entry') as HTMLInputElement[];
    expect(fields).toHaveLength(2);
    expect(fields[0].value).toBe('HelloWorld'); // text stays put on the row
    expect(fields[1].value).toBe(''); // the new row below is blank
    expect(fields[1]).toHaveFocus();

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect((onSubmit.mock.calls[0][0] as Item).checklist!.map((e) => e.label)).toEqual([
      'HelloWorld',
    ]);
  });

  it('Backspace at the start of a non-empty entry does nothing', async () => {
    const onSubmit = vi.fn();
    const initial: Item = {
      id: 'cl-nb', name: 'Pack', category: 'activity',
      checklist: [
        { id: 'a', label: 'Hello', checked: false },
        { id: 'b', label: 'World', checked: false },
      ],
    };
    render(<ItemEditor itemId="cl-nb" initialItem={initial} trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    const fields = screen.getAllByPlaceholderText('Checklist entry') as HTMLInputElement[];
    fields[1].setSelectionRange(0, 0);
    fireEvent.keyDown(fields[1], { key: 'Backspace' });

    const after = screen.getAllByPlaceholderText('Checklist entry') as HTMLInputElement[];
    expect(after).toHaveLength(2);
    expect(after.map((f) => f.value)).toEqual(['Hello', 'World']);

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect((onSubmit.mock.calls[0][0] as Item).checklist).toEqual([
      { id: 'a', label: 'Hello', checked: false },
      { id: 'b', label: 'World', checked: false },
    ]);
  });

  it('Backspace at the start of an empty entry deletes it and focuses the previous one', async () => {
    const onSubmit = vi.fn();
    const initial: Item = {
      id: 'cl-bsp', name: 'Pack', category: 'activity',
      checklist: [
        { id: 'a', label: 'Passport', checked: false },
        { id: 'b', label: '', checked: false },
      ],
    };
    render(<ItemEditor itemId="cl-bsp" initialItem={initial} trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    const fields = screen.getAllByPlaceholderText('Checklist entry') as HTMLInputElement[];
    fields[1].setSelectionRange(0, 0);
    fireEvent.keyDown(fields[1], { key: 'Backspace' });

    expect(screen.getAllByPlaceholderText('Checklist entry')).toHaveLength(1);
    expect(screen.getByPlaceholderText('Checklist entry')).toHaveFocus();

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect((onSubmit.mock.calls[0][0] as Item).checklist).toEqual([
      { id: 'a', label: 'Passport', checked: false },
    ]);
  });

  it('Backspace at the start of a non-empty first entry keeps it', () => {
    const initial: Item = {
      id: 'cl-first', name: 'Pack', category: 'activity',
      checklist: [{ id: 'a', label: 'Hello', checked: false }],
    };
    render(<ItemEditor itemId="cl-first" initialItem={initial} onSubmit={() => {}} />);

    const field = screen.getByPlaceholderText('Checklist entry') as HTMLInputElement;
    field.setSelectionRange(0, 0);
    fireEvent.keyDown(field, { key: 'Backspace' });

    expect(screen.getAllByPlaceholderText('Checklist entry')).toHaveLength(1);
    expect(field.value).toBe('Hello');
  });

  it('Backspace on an empty first entry deletes it and dismisses the keyboard', () => {
    render(<ItemEditor itemId="cl-del" trip={TRIP} initialDate={INIT_DATE} onSubmit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    const field = screen.getByPlaceholderText('Checklist entry') as HTMLInputElement;
    field.setSelectionRange(0, 0);

    fireEvent.keyDown(field, { key: 'Backspace' });

    // The row is gone and focus released (the field is no longer in the document).
    expect(screen.queryByPlaceholderText('Checklist entry')).not.toBeInTheDocument();
    expect(field).not.toHaveFocus();
  });

  it('a freshly added entry opens focused so the keyboard rises', () => {
    render(<ItemEditor itemId="cl-af" trip={TRIP} initialDate={INIT_DATE} onSubmit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(screen.getByPlaceholderText('Checklist entry')).toHaveFocus();
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

    // Toggles are announced by the entry's own label (positional "Toggle
    // entry N" is only the fallback for entries not yet named).
    expect(screen.getByRole('button', { name: 'Passport' })).toHaveAttribute(
      'data-system-image',
      'checkmark.circle.fill',
    );
    expect(screen.getByRole('button', { name: 'Sunscreen' })).toHaveAttribute(
      'data-system-image',
      'circle',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sunscreen' }));

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

  // --- Trip selector (Share editor, issue #108) ---

  const TRIP_OPTIONS = [
    { id: 't1', label: 'Big Sur', past: false },
    { id: 't2', label: 'Last Year', past: true },
  ];

  it('renders a Trip picker selecting the given trip when tripOptions are provided', () => {
    render(
      <ItemEditor
        itemId="x"
        trip={TRIP}
        initialDate={INIT_DATE}
        tripOptions={TRIP_OPTIONS}
        selectedTripId="t1"
        onSelectTrip={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(pickers['Trip']).toBeDefined();
    expect(pickers['Trip'].selection).toBe('t1');
  });

  it('omits the Trip picker when no tripOptions are provided', () => {
    render(<ItemEditor itemId="x" trip={TRIP} initialDate={INIT_DATE} onSubmit={() => {}} />);
    expect(pickers['Trip']).toBeUndefined();
  });

  it('marks past trips in the option list and leaves active ones unmarked', () => {
    render(
      <ItemEditor
        itemId="x"
        trip={TRIP}
        initialDate={INIT_DATE}
        tripOptions={TRIP_OPTIONS}
        selectedTripId="t1"
        onSelectTrip={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByText('Big Sur')).toBeInTheDocument();
    expect(screen.getByText('Last Year · Past')).toBeInTheDocument();
  });

  it('changing the Trip picker calls onSelectTrip with the chosen trip id', () => {
    const onSelectTrip = vi.fn();
    render(
      <ItemEditor
        itemId="x"
        trip={TRIP}
        initialDate={INIT_DATE}
        tripOptions={TRIP_OPTIONS}
        selectedTripId="t1"
        onSelectTrip={onSelectTrip}
        onSubmit={() => {}}
      />,
    );
    act(() => pickers['Trip'].onSelectionChange!('t2'));
    expect(onSelectTrip).toHaveBeenCalledWith('t2');
  });

  it('re-seeds the editable day when initialDate changes (e.g. after a trip switch)', async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <ItemEditor itemId="x" trip={TRIP} initialDate="2025-06-03" onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Hike' } });
    rerender(
      <ItemEditor
        itemId="x"
        trip={{ startDate: '2025-07-01', endDate: '2025-07-10' }}
        initialDate="2025-07-01"
        onSubmit={onSubmit}
      />,
    );
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { id: 'x', name: 'Hike', category: 'activity' },
        '2025-07-01',
      ),
    );
  });

  it('location set via picker is included in the submitted item', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="loc-2" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('What is it?'), { target: { value: 'Caldera view' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
    // The picker lives on its own route; the editor hands its callback to the store.
    const onConfirm = usePickerStore.getState().onConfirm;
    expect(onConfirm).not.toBeNull();
    act(() => onConfirm!({ address: 'Santorini', lat: 36.39, lng: 25.46 }));

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
