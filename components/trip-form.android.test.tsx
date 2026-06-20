import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import * as ImagePicker from 'expo-image-picker';
import { TripForm } from '@/components/trip-form.android';

// Android (Compose) trip-form variant. @expo/ui/jetpack-compose is globally
// aliased to a DOM stub (vitest.config.ts): Buttons render as <button> (query by
// text), the title TextField as <input data-testid="textfield"> (placeholder
// "Title"), and each DateTimePicker as <input type=date data-testid="datepicker">
// — the first is the start endpoint, the second the end. react-hook-form runs for
// real; only expo-router and expo-image-picker are mocked.
/* eslint-disable react/display-name -- inline passthrough stand-ins for native views */
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
    React.createElement(
      'button',
      { onClick: onPress, disabled, 'aria-label': accessibilityLabel },
      children,
    );
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

/** The two inline date inputs, in render order: [start, end]. */
function datePickers() {
  return screen.getAllByTestId('datepicker') as HTMLInputElement[];
}

describe('TripForm (Android)', () => {
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
    fireEvent.change(screen.getByPlaceholderText('Title'), {
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
    // Picking is async (permission + library); wait for the change action to
    // appear, then flush pending work so the Create handler closes over the
    // picked cover rather than the pre-pick state.
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
    renderForm({
      initialTitle: 'Coast',
      initialStartDate: '2026-07-01',
      initialEndDate: '2026-07-03',
    });

    const [start, end] = datePickers();
    expect(start.defaultValue).toBe('2026-07-01');
    expect(end.defaultValue).toBe('2026-07-03');
  });

  it('edits the end endpoint independently of the start', async () => {
    const { onSubmit } = renderForm({
      initialTitle: 'Coast',
      initialStartDate: '2026-07-01',
      initialEndDate: '2026-07-03',
    });

    const [, end] = datePickers();
    fireEvent.change(end, { target: { value: '2026-07-10' } });
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

    const [start] = datePickers();
    fireEvent.change(start, { target: { value: '2026-07-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2026-07-20', endDate: '2026-07-20' }),
      ),
    );
  });

  it('shows a single "Trip dates" button on the edit path that calls onEditDates', () => {
    const onEditDates = vi.fn();
    renderForm({
      initialTitle: 'Coast',
      initialStartDate: '2026-07-01',
      initialEndDate: '2026-07-03',
      onEditDates,
    });

    expect(screen.queryAllByTestId('datepicker')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /trip dates/i }));
    expect(onEditDates).toHaveBeenCalledWith({ startDate: '2026-07-01', endDate: '2026-07-03' });
  });

  it('invokes onCancel when Cancel is pressed', () => {
    const { onCancel } = renderForm({ initialTitle: 'Coast' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
