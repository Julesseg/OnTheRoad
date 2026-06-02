import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as ImagePicker from 'expo-image-picker';
import { TripForm } from '@/components/trip-form';

// The SwiftUI graphical DatePicker is native-only; render its host transparently
// and drop the picker (dates are driven through props in these specs).
vi.mock('@expo/ui/swift-ui', () => ({
  Host: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
  DatePicker: () => null,
}));
vi.mock('@expo/ui/swift-ui/modifiers', () => ({ datePickerStyle: vi.fn(() => ({})) }));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
}));
vi.mock('expo-image', () => ({
  Image: ({ source }: { source?: { uri?: string } }) =>
    React.createElement('img', { alt: 'cover', src: source?.uri }),
}));
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

describe('TripForm', () => {
  it('warns and does not submit when the title is empty', async () => {
    const { Alert } = await import('react-native');
    const alertSpy = vi.spyOn(Alert, 'alert');
    const { onSubmit } = renderForm({ initialTitle: '   ' });

    fireEvent.click(screen.getByLabelText('Create'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('warns and does not submit when the end date precedes the start date', async () => {
    const { Alert } = await import('react-native');
    const alertSpy = vi.spyOn(Alert, 'alert');
    const { onSubmit } = renderForm({
      initialTitle: 'Coast',
      initialStartDate: '2026-07-10',
      initialEndDate: '2026-07-05',
    });

    fireEvent.click(screen.getByLabelText('Create'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a trimmed title and the chosen dates with no cover', () => {
    const { onSubmit } = renderForm();
    fireEvent.change(screen.getByPlaceholderText(/Pacific Coast Highway/), {
      target: { value: '  Coast Run  ' },
    });

    fireEvent.click(screen.getByLabelText('Create'));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Coast Run',
      startDate: '2026-07-01',
      endDate: '2026-07-03',
      cover: { kind: 'none' },
    });
  });

  it('keeps an existing wallpaper unchanged when it is not touched', () => {
    const { onSubmit } = renderForm({
      initialTitle: 'Coast',
      initialWallpaperUri: 'file://display/wallpaper.jpg',
    });

    fireEvent.click(screen.getByLabelText('Create'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        cover: { kind: 'existing', displayUri: 'file://display/wallpaper.jpg' },
      }),
    );
  });

  it('submits cover "none" after the existing wallpaper is removed', () => {
    const { onSubmit } = renderForm({
      initialTitle: 'Coast',
      initialWallpaperUri: 'file://display/wallpaper.jpg',
    });

    fireEvent.click(screen.getByLabelText('Remove cover photo'));
    fireEvent.click(screen.getByLabelText('Create'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ cover: { kind: 'none' } }),
    );
  });

  it('submits the picked uri after a cover photo is added', async () => {
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://picked.jpg' }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);
    const { onSubmit } = renderForm({ initialTitle: 'Coast' });

    fireEvent.click(screen.getByLabelText('Add cover photo'));
    // Picking is async (permission + library); wait for the preview to appear.
    await waitFor(() => screen.getByLabelText('Change cover photo'));
    fireEvent.click(screen.getByLabelText('Create'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ cover: { kind: 'picked', uri: 'file://picked.jpg' } }),
    );
  });

  it('does not change the cover when the picker is cancelled', async () => {
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: true,
      assets: null,
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);
    const { onSubmit } = renderForm({ initialTitle: 'Coast' });

    fireEvent.click(screen.getByLabelText('Add cover photo'));
    await Promise.resolve();
    fireEvent.click(screen.getByLabelText('Create'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ cover: { kind: 'none' } }),
    );
  });

  it('invokes onCancel when Cancel is pressed', () => {
    const { onCancel } = renderForm({ initialTitle: 'Coast' });
    fireEvent.click(screen.getByLabelText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});
