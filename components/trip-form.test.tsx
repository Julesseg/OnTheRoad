import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import * as ImagePicker from 'expo-image-picker';
import { TripForm } from '@/components/trip-form';

// The native SwiftUI DatePickers are native-only. Capture each row's props,
// keyed by its title ("Start"/"End"), so specs can drive a date change the way a
// tap on the calendar would and assert which endpoint each row is bound to.
const pickers = vi.hoisted(
  () => ({}) as Record<string, { onDateChange?: (d: Date) => void; selection?: Date }>,
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
    // Render the footer so inline validation errors are queryable.
    Section: ({ children, footer }: { children?: React.ReactNode; footer?: React.ReactNode }) =>
      React.createElement('div', null, children, footer),
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
        defaultValue: text?.value,
        onChange: (e: { target: { value: string } }) => onTextChange?.(e.target.value),
      }),
    DatePicker: (props: { title?: string; onDateChange?: (d: Date) => void; selection?: Date }) => {
      if (props.title) {
        pickers[props.title] = { onDateChange: props.onDateChange, selection: props.selection };
      }
      return null;
    },
    Button: ({
      label,
      onPress,
      disabled,
    }: {
      label?: string;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      label ? React.createElement('button', { onClick: onPress, disabled }, label) : null,
    Image: ({ uiImage }: { uiImage?: string }) =>
      React.createElement('img', { alt: 'cover', src: uiImage }),
  };
});
vi.mock('@expo/ui/swift-ui/modifiers', () => ({
  datePickerStyle: vi.fn(() => ({})),
  frame: vi.fn(() => ({})),
  font: vi.fn(() => ({})),
  foregroundStyle: vi.fn(() => ({})),
  tint: vi.fn(() => ({})),
  background: vi.fn(() => ({})),
  listRowBackground: vi.fn(() => ({})),
  scrollContentBackground: vi.fn(() => ({})),
  resizable: vi.fn(() => ({})),
  aspectRatio: vi.fn(() => ({})),
  clipped: vi.fn(() => ({})),
}));

// The form drives Cancel/Save through expo-router's native Stack toolbar.
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
    disabled,
    accessibilityLabel,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    accessibilityLabel?: string;
  }) =>
    React.createElement('button', { onClick: onPress, disabled, 'aria-label': accessibilityLabel }, children);
  return { Stack };
});

vi.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
}));

const granted = { granted: true } as Awaited<
  ReturnType<typeof ImagePicker.requestMediaLibraryPermissionsAsync>
>;

beforeEach(() => {
  for (const k of Object.keys(pickers)) delete pickers[k];
  vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue(granted);
});

afterEach(() => vi.restoreAllMocks());

function renderForm(props: Partial<React.ComponentProps<typeof TripForm>> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <TripForm
      heading="New Trip"
      submitLabel="Create"
      initialStartDate="2026-07-01"
      initialEndDate="2026-07-03"
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onSubmit, onCancel };
}

describe('TripForm', () => {
  it('shows an inline error and does not submit when the title is empty', async () => {
    const { onSubmit } = renderForm({ initialTitle: '   ' });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText(/title/i)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows an inline error and does not submit when the end date precedes the start', async () => {
    const { onSubmit } = renderForm({
      initialTitle: 'Coast',
      initialStartDate: '2026-07-10',
      initialEndDate: '2026-07-05',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText(/before the start/i)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a trimmed title and the chosen dates with no cover', async () => {
    const { onSubmit } = renderForm();
    fireEvent.change(screen.getByPlaceholderText(/Pacific Coast Highway/), {
      target: { value: '  Coast Run  ' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Coast Run',
        startDate: '2026-07-01',
        endDate: '2026-07-03',
        cover: { kind: 'none' },
      }),
    );
  });

  it('keeps an existing wallpaper unchanged when it is not touched', async () => {
    const { onSubmit } = renderForm({
      initialTitle: 'Coast',
      initialWallpaperUri: 'file://display/wallpaper.jpg',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          cover: { kind: 'existing', displayUri: 'file://display/wallpaper.jpg' },
        }),
      ),
    );
  });

  it('submits cover "none" after the existing wallpaper is removed', async () => {
    const { onSubmit } = renderForm({
      initialTitle: 'Coast',
      initialWallpaperUri: 'file://display/wallpaper.jpg',
    });

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ cover: { kind: 'none' } })),
    );
  });

  it('submits the picked uri after a cover photo is added', async () => {
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://picked.jpg' }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);
    const { onSubmit } = renderForm({ initialTitle: 'Coast' });

    fireEvent.click(screen.getByRole('button', { name: /add cover photo/i }));
    // Picking is async (permission + library); wait for the change action to appear,
    // then flush pending work so the Create handler closes over the picked cover
    // rather than the pre-pick state.
    await screen.findByRole('button', { name: /change/i });
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ cover: { kind: 'picked', uri: 'file://picked.jpg' } }),
      ),
    );
  });

  it('does not change the cover when the picker is cancelled', async () => {
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: true,
      assets: null,
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);
    const { onSubmit } = renderForm({ initialTitle: 'Coast' });

    fireEvent.click(screen.getByRole('button', { name: /add cover photo/i }));
    await Promise.resolve();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ cover: { kind: 'none' } })),
    );
  });

  it('binds the two date rows to the start and end endpoints', () => {
    renderForm({ initialTitle: 'Coast', initialStartDate: '2026-07-01', initialEndDate: '2026-07-03' });

    expect(pickers['Start'].selection).toEqual(new Date(2026, 6, 1));
    expect(pickers['End'].selection).toEqual(new Date(2026, 6, 3));
  });

  it('edits the end endpoint independently of the start', async () => {
    const { onSubmit } = renderForm({
      initialTitle: 'Coast',
      initialStartDate: '2026-07-01',
      initialEndDate: '2026-07-03',
    });

    act(() => pickers['End'].onDateChange!(new Date(2026, 6, 10)));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2026-07-01', endDate: '2026-07-10' }),
      ),
    );
  });

  it('drags the end date along when the start moves past it', async () => {
    const { onSubmit } = renderForm({
      initialTitle: 'Coast',
      initialStartDate: '2026-07-01',
      initialEndDate: '2026-07-03',
    });

    act(() => pickers['Start'].onDateChange!(new Date(2026, 6, 20)));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2026-07-20', endDate: '2026-07-20' }),
      ),
    );
  });

  it('invokes onCancel when Cancel is pressed', () => {
    const { onCancel } = renderForm({ initialTitle: 'Coast' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
