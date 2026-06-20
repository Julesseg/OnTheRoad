import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ItemEditor } from '@/components/item-editor.android';
import { usePickerStore } from '@/lib/location-picker-store';
import type { Item } from '@/lib/schema';

// Android (Compose) variant of the item editor. @expo/ui/jetpack-compose is globally
// aliased to a DOM stub (vitest.config.ts): SegmentedButton → <button aria-pressed>,
// TextField → <input data-testid="textfield">, Switch → <input role=switch>,
// Checkbox → <input type=checkbox>, DateTimePicker → <input type=date
// data-testid="datepicker">, Button/IconButton → <button>. The expo-router chrome is
// mocked identically to the iOS test so the Stack.Toolbar Save/Cancel/Delete buttons
// render as queryable <button>s.

/* eslint-disable react/display-name -- inline passthrough stand-ins for native chrome */
const routerMock = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn() }));

vi.mock('expo-router', async () => {
  const React = await import('react');
  const Stack: any = () => null;
  Stack.Header = () => null;
  Stack.Title = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children);
  Stack.Toolbar = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  Stack.Toolbar.Button = ({
    onPress,
    accessibilityLabel,
    disabled,
  }: {
    onPress?: () => void;
    accessibilityLabel?: string;
    disabled?: boolean;
  }) =>
    React.createElement('button', {
      type: 'button',
      onClick: onPress,
      'aria-label': accessibilityLabel,
      disabled,
    });
  return { Stack, router: routerMock };
});

beforeEach(() => {
  routerMock.push.mockClear();
  routerMock.back.mockClear();
  usePickerStore.getState().end();
});
afterEach(() => vi.restoreAllMocks());

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
}
function nameField() {
  return screen.getByPlaceholderText('Title');
}
function timeToggle() {
  return screen.getByRole('switch');
}
function datepicker(): HTMLInputElement | undefined {
  return screen.queryAllByTestId('datepicker').at(-1) as HTMLInputElement | undefined;
}

const TRIP = { startDate: '2025-06-01', endDate: '2025-06-07' };
const INIT_DATE = '2025-06-03';

describe('ItemEditor (Android)', () => {
  it('renders name and notes fields for a new item', () => {
    render(<ItemEditor itemId="x" onSubmit={() => {}} />);
    expect(screen.getByPlaceholderText('Title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Notes')).toBeInTheDocument();
  });

  it('renders a category segmented row defaulting to "activity" (Activity pressed)', () => {
    render(<ItemEditor itemId="x" onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Activity' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Stay' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('sheet title reflects the currently selected category', () => {
    render(<ItemEditor itemId="x" onSubmit={() => {}} />);
    expect(screen.getByText('New Activity')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.getByText('New Stay')).toBeInTheDocument();
  });

  it('disables Save while the name is empty and enables it once a name is typed', () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="x" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(nameField(), { target: { value: 'Hike' } });
    expect(saveButton).toBeEnabled();
  });

  it('keeps Save disabled when the name is only whitespace', () => {
    render(<ItemEditor itemId="x" onSubmit={() => {}} />);
    fireEvent.change(nameField(), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('submits a built item with the selected category when name is filled', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="act-1" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(nameField(), { target: { value: 'Whale watching' } });
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { id: 'act-1', name: 'Whale watching', category: 'activity' },
        INIT_DATE,
      ),
    );
  });

  it('submits with a different category when changed via the segmented row', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="meal-1" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(nameField(), { target: { value: 'Taco truck' } });
    fireEvent.click(screen.getByRole('button', { name: 'Meal' }));
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { id: 'meal-1', name: 'Taco truck', category: 'meal' },
        INIT_DATE,
      ),
    );
  });

  // --- Time ---

  it('starts with the Time toggle off and no picker for a new (timeless) item', () => {
    render(<ItemEditor itemId="x" onSubmit={() => {}} />);
    expect(timeToggle()).not.toBeChecked();
    expect(screen.queryByTestId('datepicker')).not.toBeInTheDocument();
  });

  it('switching the Time toggle on defaults to 09:00, shows the picker, and persists it', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="act-t" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(nameField(), { target: { value: 'Hike' } });

    fireEvent.click(timeToggle());
    expect(timeToggle()).toBeChecked();
    // Enabling defaults to 09:00, shown next to the Time label and as a picker.
    expect(screen.getByText('9:00 AM')).toBeInTheDocument();
    expect(datepicker()).toBeInTheDocument();

    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { id: 'act-t', name: 'Hike', category: 'activity', time: '09:00' },
        INIT_DATE,
      ),
    );
  });

  it('changing the time picker persists the chosen time on save', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="act-tc" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(nameField(), { target: { value: 'Hike' } });
    fireEvent.click(timeToggle());

    // The time picker is the last datepicker on screen (the date row is first). The
    // stub fires onDateSelected(new Date(value+'T00:00:00')), so the saved time is
    // the local midnight of the chosen date — "00:00".
    act(() => {
      fireEvent.change(datepicker()!, { target: { value: '2025-06-03' } });
    });
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { id: 'act-tc', name: 'Hike', category: 'activity', time: '00:00' },
        INIT_DATE,
      ),
    );
  });

  it('opening an existing timed item starts on, showing the value and picker', () => {
    const initial: Item = { id: 'act-e', name: 'Hike', category: 'activity', time: '08:00' };
    render(<ItemEditor itemId="act-e" initialItem={initial} trip={TRIP} initialDate={INIT_DATE} onSubmit={() => {}} />);
    expect(timeToggle()).toBeChecked();
    expect(screen.getByText('8:00 AM')).toBeInTheDocument();
    expect(screen.queryAllByTestId('datepicker').length).toBeGreaterThan(0);
  });

  it('switching the Time toggle off clears the time', async () => {
    const onSubmit = vi.fn();
    const initial: Item = { id: 'act-c', name: 'Hike', category: 'activity', time: '08:00' };
    render(<ItemEditor itemId="act-c" initialItem={initial} trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    expect(timeToggle()).toBeChecked();
    fireEvent.click(timeToggle());
    expect(timeToggle()).not.toBeChecked();
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ id: 'act-c', name: 'Hike', category: 'activity' }, INIT_DATE),
    );
  });

  // --- Pre-fill / delete ---

  it('pre-fills name and category when editing an existing item', () => {
    const initial: Item = { id: 'stay-1', name: 'Sea Cliff Inn', category: 'stay' };
    render(<ItemEditor itemId="stay-1" initialItem={initial} onSubmit={() => {}} />);
    expect((nameField() as HTMLInputElement).defaultValue).toBe('Sea Cliff Inn');
    expect(screen.getByRole('button', { name: 'Stay' })).toHaveAttribute('aria-pressed', 'true');
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

  it('invokes onCancel from the Cancel toolbar button', () => {
    const onCancel = vi.fn();
    render(<ItemEditor itemId="x" onSubmit={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('surfaces tappable links found in the notes field', () => {
    const initial: Item = { id: 'a', name: 'Hike', category: 'activity', notes: 'trailhead https://example.com' };
    render(<ItemEditor itemId="a" initialItem={initial} onSubmit={() => {}} />);
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  // --- Date ---

  it('renders a date picker seeded to initialDate', () => {
    render(<ItemEditor itemId="x" trip={TRIP} initialDate={INIT_DATE} onSubmit={() => {}} />);
    const dp = screen.getAllByTestId('datepicker')[0] as HTMLInputElement;
    expect(dp.defaultValue).toBe('2025-06-03');
  });

  it('saving with unchanged date passes initialDate as second arg to onSubmit', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="d-1" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(nameField(), { target: { value: 'Boat tour' } });
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ id: 'd-1', name: 'Boat tour', category: 'activity' }, INIT_DATE),
    );
  });

  it('changing the date picker fires onSubmit with the new YYYY-MM-DD string', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="d-2" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(nameField(), { target: { value: 'Swim' } });
    const dp = screen.getAllByTestId('datepicker')[0] as HTMLInputElement;
    act(() => {
      fireEvent.change(dp, { target: { value: '2025-06-05' } });
    });
    save();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ id: 'd-2', name: 'Swim', category: 'activity' }, '2025-06-05'),
    );
  });

  it('renders the location glyph and the category title glyph', () => {
    const { container } = render(
      <ItemEditor itemId="x" trip={TRIP} initialDate={INIT_DATE} onSubmit={() => {}} />,
    );
    // IconSymbol → MaterialIcons stub (<span data-icon=...>). Location row = map;
    // the title carries the activity category glyph (hiking).
    const icons = Array.from(container.querySelectorAll('[data-testid="material-icon"]')).map(
      (el) => el.getAttribute('data-icon'),
    );
    expect(icons).toContain('map');
    expect(icons).toContain('hiking');
  });

  // --- Location ---

  it('shows an "Add location" affordance when the item has no location', () => {
    render(<ItemEditor itemId="x" onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Add location' })).toBeInTheDocument();
  });

  it('shows the address in the location row when item has location.address', () => {
    const initial: Item = { id: 'x', name: 'Hike', category: 'activity', location: { address: 'Santorini' } };
    render(<ItemEditor itemId="x" initialItem={initial} onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Santorini' })).toBeInTheDocument();
  });

  it('shows lat,lng when the item has only coords', () => {
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
    expect(usePickerStore.getState().state.query).toBe('');
    expect(usePickerStore.getState().onConfirm).not.toBeNull();
  });

  it('location set via picker is included in the submitted item', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="loc-2" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    fireEvent.change(nameField(), { target: { value: 'Caldera view' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
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

  // --- Checklist ---

  it('shows existing checklist entries as editable fields', () => {
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

  it('adds an entry typed in the composer and includes it on save, unchecked with a fresh id', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="cl-1" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(nameField(), { target: { value: 'Pack bags' } });

    fireEvent.change(screen.getByPlaceholderText('Add entry'), { target: { value: 'Passport' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

    // The committed entry now shows as its own row.
    expect(
      (screen.getAllByPlaceholderText('Checklist entry') as HTMLInputElement[]).map((f) => f.defaultValue),
    ).toEqual(['Passport']);

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const item = onSubmit.mock.calls[0][0] as Item;
    expect(item.checklist).toHaveLength(1);
    expect(item.checklist![0]).toMatchObject({ label: 'Passport', checked: false });
    expect(item.checklist![0].id).toBeTruthy();
  });

  it('folds a half-typed composer draft into the saved item without pressing Add', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="cl-d" trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);
    fireEvent.change(nameField(), { target: { value: 'Pack' } });
    fireEvent.change(screen.getByPlaceholderText('Add entry'), { target: { value: '  Visa  ' } });
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const item = onSubmit.mock.calls[0][0] as Item;
    expect(item.checklist).toHaveLength(1);
    expect(item.checklist![0]).toMatchObject({ label: 'Visa', checked: false });
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

  it('toggles an entry checkbox and saves the new checked state', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="cl-2" initialItem={PACK_ITEM} trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    // The entry checkboxes are the non-switch checkboxes in document order.
    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter((el) => el.getAttribute('role') !== 'switch');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
    fireEvent.click(checkboxes[1]);

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect((onSubmit.mock.calls[0][0] as Item).checklist).toEqual([
      { id: 'c1', label: 'Passport', checked: true },
      { id: 'c2', label: 'Sunscreen', checked: true },
    ]);
  });

  it('deletes an entry via its delete button and saves the remainder', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="cl-2" initialItem={PACK_ITEM} trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete entry 1' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Delete entry 1' }));
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect('checklist' in (onSubmit.mock.calls[0][0] as Item)).toBe(false);
  });

  it('reorders entries via the move buttons (moveEntries) and saves the new order', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor itemId="cl-2" initialItem={PACK_ITEM} trip={TRIP} initialDate={INIT_DATE} onSubmit={onSubmit} />);

    // Move the second entry up. The first row's "Move up" is disabled, so click the
    // second row's (index 1).
    const moveUps = screen.getAllByRole('button', { name: 'Move up' });
    expect(moveUps[0]).toBeDisabled();
    fireEvent.click(moveUps[1]);
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect((onSubmit.mock.calls[0][0] as Item).checklist!.map((e) => e.label)).toEqual([
      'Sunscreen',
      'Passport',
    ]);
  });

  // --- Trip selector (Share editor) ---

  const TRIP_OPTIONS = [
    { id: 't1', label: 'Big Sur', past: false },
    { id: 't2', label: 'Last Year', past: true },
  ];

  it('renders a Trip selector marking the selected trip when tripOptions are provided', () => {
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
    expect(screen.getByRole('button', { name: 'Big Sur' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('omits the Trip selector when no tripOptions are provided', () => {
    render(<ItemEditor itemId="x" trip={TRIP} initialDate={INIT_DATE} onSubmit={() => {}} />);
    expect(screen.queryByText('Trip')).not.toBeInTheDocument();
  });

  it('changing the Trip selector calls onSelectTrip with the chosen trip id', () => {
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
    fireEvent.click(screen.getByText('Last Year · Past'));
    expect(onSelectTrip).toHaveBeenCalledWith('t2');
  });

  it('re-seeds the editable day when initialDate changes (e.g. after a trip switch)', async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <ItemEditor itemId="x" trip={TRIP} initialDate="2025-06-03" onSubmit={onSubmit} />,
    );
    fireEvent.change(nameField(), { target: { value: 'Hike' } });
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
      expect(onSubmit).toHaveBeenCalledWith({ id: 'x', name: 'Hike', category: 'activity' }, '2025-07-01'),
    );
  });
});
