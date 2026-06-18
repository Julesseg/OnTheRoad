import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// The native chrome is expo-router's Stack.Header / Stack.Title; Header renders
// nothing and Title renders its text so it stays queryable under jsdom.
/* eslint-disable react/display-name -- inline passthrough stand-ins for native views */
vi.mock('expo-router', async () => {
  const React = await import('react');
  const Stack: any = () => null;
  Stack.Header = () => null;
  Stack.Title = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children);
  return { Stack, router: { back: vi.fn(), dismissAll: vi.fn() } };
});

// Alert is a native surface; capture its calls so we can inspect titles/messages.
const alertMock = vi.hoisted(() => vi.fn());
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    PlatformColor: (...names: string[]) => ({ semantic: names }),
    Alert: { alert: alertMock },
  };
});

const clipboardMock = vi.hoisted(() => ({ setStringAsync: vi.fn().mockResolvedValue(true) }));
vi.mock('expo-clipboard', () => clipboardMock);

vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }));

// safe-area-context ships Flow the test transform can't parse; stub it. The Liquid
// Glass material resolves under jsdom but reports no glass, so the GlassView branch
// stays inert and the solid-accent fallback is exercised.
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
}));
vi.mock('expo-glass-effect', () => ({
  isLiquidGlassAvailable: () => false,
  GlassView: () => null,
}));
vi.mock('expo-symbols', () => ({ SymbolView: () => null }));

const storeMock = vi.hoisted(() => ({ importTrip: vi.fn(), setDisplayedTrip: vi.fn() }));
vi.mock('@/lib/store', () => ({
  useTripStore: () => ({
    importTrip: storeMock.importTrip,
    setDisplayedTrip: storeMock.setDisplayedTrip,
  }),
}));

import { buildSchemaPrompt } from '@/lib/schema-prompt';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

const renderSheet = async () => {
  const { default: ImportSheet } = await import('@/app/import');
  render(<ImportSheet />);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ImportSheet — JSON file import', () => {
  it('picks a JSON file, imports it, opens the new trip, and dismisses', async () => {
    vi.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/trip.json' }],
    } as any);
    storeMock.importTrip.mockResolvedValue({ id: 'fresh-id' });
    await renderSheet();

    fireEvent.click(screen.getByText('Choose File'));

    await waitFor(() => expect(storeMock.setDisplayedTrip).toHaveBeenCalledWith('fresh-id'));
    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'application/json' }),
    );
    expect(storeMock.importTrip).toHaveBeenCalledWith('file:///picked/trip.json');
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('surfaces the validation error verbatim and opens nothing when the file is invalid', async () => {
    vi.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/bad.json' }],
    } as any);
    // importTrip rethrows trip-io's field-level message verbatim; the sheet must
    // show it, not a generic one.
    storeMock.importTrip.mockRejectedValue(new Error('Missing required field: startDate'));
    await renderSheet();

    fireEvent.click(screen.getByText('Choose File'));

    await waitFor(() =>
      expect(alertMock).toHaveBeenCalledWith('Import failed', 'Missing required field: startDate'),
    );
    expect(storeMock.setDisplayedTrip).not.toHaveBeenCalled();
    expect(router.dismissAll).not.toHaveBeenCalled();
  });

  it('does nothing when the file picker is cancelled', async () => {
    vi.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: true } as any);
    await renderSheet();

    fireEvent.click(screen.getByText('Choose File'));

    await waitFor(() => expect(DocumentPicker.getDocumentAsync).toHaveBeenCalled());
    expect(storeMock.importTrip).not.toHaveBeenCalled();
    expect(storeMock.setDisplayedTrip).not.toHaveBeenCalled();
    expect(router.dismissAll).not.toHaveBeenCalled();
  });
});

describe('ImportSheet — Schema Prompt round trip', () => {
  it('explains the three-step external-LLM round trip', async () => {
    await renderSheet();

    expect(screen.getByText(/copy the prompt/i)).toBeInTheDocument();
    expect(screen.getByText(/paste it into your favorite ai chat/i)).toBeInTheDocument();
    expect(screen.getByText(/download the file it produces/i)).toBeInTheDocument();
  });

  it('copies the Schema Prompt and confirms inline with a checkmark, no popup', async () => {
    await renderSheet();

    fireEvent.click(screen.getByText('Copy Prompt'));

    await waitFor(() =>
      expect(clipboardMock.setStringAsync).toHaveBeenCalledWith(buildSchemaPrompt()),
    );
    // The button itself confirms by morphing to "Copied" — no alert popup.
    await waitFor(() => expect(screen.getByText('Copied')).toBeInTheDocument());
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('warns instead of confirming when the clipboard write fails', async () => {
    clipboardMock.setStringAsync.mockResolvedValueOnce(false);
    await renderSheet();

    fireEvent.click(screen.getByText('Copy Prompt'));

    await waitFor(() =>
      expect(alertMock.mock.calls.some(([title]) => /couldn.?t copy/i.test(String(title)))).toBe(
        true,
      ),
    );
    expect(alertMock.mock.calls.some(([title]) => /copied/i.test(String(title)))).toBe(false);
  });

  it('warns when the clipboard write rejects rather than leaving it unhandled', async () => {
    clipboardMock.setStringAsync.mockRejectedValueOnce(new Error('clipboard unavailable'));
    await renderSheet();

    fireEvent.click(screen.getByText('Copy Prompt'));

    await waitFor(() =>
      expect(alertMock.mock.calls.some(([title]) => /couldn.?t copy/i.test(String(title)))).toBe(
        true,
      ),
    );
  });
});
