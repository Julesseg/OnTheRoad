import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// The native chrome is expo-router's Stack.Header / Stack.Title / Stack.Toolbar.
// Header renders nothing; Title renders its text; the toolbar buttons render as
// DOM buttons keyed by their accessibility label so they stay queryable.
/* eslint-disable react/display-name -- inline passthrough stand-ins for native views */
vi.mock('expo-router', async () => {
  const React = await import('react');
  const Stack: any = () => null;
  Stack.Header = () => null;
  Stack.Title = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children);
  const Toolbar = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  Toolbar.Button = ({
    accessibilityLabel,
    onPress,
  }: {
    accessibilityLabel?: string;
    onPress?: () => void;
  }) => React.createElement('button', { onClick: onPress, 'aria-label': accessibilityLabel });
  Stack.Toolbar = Toolbar;
  return { Stack, router: { back: vi.fn(), dismissAll: vi.fn() } };
});

const alertMock = vi.hoisted(() => vi.fn());
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    PlatformColor: (...names: string[]) => ({ semantic: names }),
    Alert: { alert: alertMock },
  };
});

// safe-area-context ships Flow the test transform can't parse; stub it.
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
}));

const storeMock = vi.hoisted(() => ({ importTripText: vi.fn(), setDisplayedTrip: vi.fn() }));
vi.mock('@/lib/store', () => ({
  useTripStore: () => ({
    importTripText: storeMock.importTripText,
    setDisplayedTrip: storeMock.setDisplayedTrip,
  }),
}));

import { router } from 'expo-router';

const renderSheet = async () => {
  const { default: ImportPasteSheet } = await import('@/app/import-paste');
  render(<ImportPasteSheet />);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ImportPasteSheet', () => {
  it('shows a text area to paste JSON into', async () => {
    await renderSheet();
    expect(screen.getByPlaceholderText(/paste/i)).toBeInTheDocument();
  });

  it('the checkmark button imports the pasted JSON, opens the trip, and dismisses', async () => {
    storeMock.importTripText.mockResolvedValue({ id: 'pasted-id' });
    await renderSheet();

    fireEvent.change(screen.getByPlaceholderText(/paste/i), {
      target: { value: '{"title":"Trip"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(storeMock.setDisplayedTrip).toHaveBeenCalledWith('pasted-id'));
    expect(storeMock.importTripText).toHaveBeenCalledWith('{"title":"Trip"}');
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('surfaces the validation error verbatim and opens nothing when the JSON is invalid', async () => {
    storeMock.importTripText.mockRejectedValue(new Error('File is not valid JSON.'));
    await renderSheet();

    fireEvent.change(screen.getByPlaceholderText(/paste/i), { target: { value: 'not json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() =>
      expect(alertMock).toHaveBeenCalledWith('Import failed', 'File is not valid JSON.'),
    );
    expect(storeMock.setDisplayedTrip).not.toHaveBeenCalled();
    expect(router.dismissAll).not.toHaveBeenCalled();
  });

  it('imports nothing when the checkmark is tapped with an empty text area', async () => {
    await renderSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(storeMock.importTripText).not.toHaveBeenCalled();
    expect(router.dismissAll).not.toHaveBeenCalled();
  });

  it('the X button closes the sheet without importing', async () => {
    await renderSheet();

    fireEvent.change(screen.getByPlaceholderText(/paste/i), { target: { value: '{"a":1}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(router.back).toHaveBeenCalled();
    expect(storeMock.importTripText).not.toHaveBeenCalled();
  });
});
