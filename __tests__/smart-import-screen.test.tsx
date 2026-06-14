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

// Alert is a native surface; capture its calls so we can inspect the gate's
// title/message and invoke its buttons. Keep the rest of react-native (aliased to
// react-native-web in tests) intact, plus the PlatformColor shim from setup.
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

// The available branch reads the safe-area insets and the Liquid Glass material.
// safe-area-context ships Flow (`import typeof`) that the test transform can't
// parse, so stub it; expo-glass-effect resolves under jsdom but reports no glass,
// exercising the solid-accent fallback (so the GlassView branch stays inert).
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
}));
vi.mock('expo-glass-effect', () => ({
  isLiquidGlassAvailable: () => false,
  GlassView: () => null,
}));

const availabilityMock = vi.hoisted(() => ({
  value: { available: false, reason: 'unsupported' } as
    | { available: true }
    | { available: false; reason: string },
}));
vi.mock('@/lib/smart-import-availability', () => ({
  getSmartImportAvailability: () => availabilityMock.value,
  smartImportUnavailableMessage: (reason: string) => `Unavailable because: ${reason}`,
}));

// The on-device generation + post-processing is unit-tested in lib/smart-import;
// here we mock it to drive the screen's save-and-open / error behavior.
const smartImportMock = vi.hoisted(() => ({ smartImportTrip: vi.fn() }));
vi.mock('@/lib/smart-import', () => smartImportMock);

const storeMock = vi.hoisted(() => ({ addTrip: vi.fn(), setDisplayedTrip: vi.fn() }));
vi.mock('@/lib/store', () => ({
  useTripStore: () => ({ addTrip: storeMock.addTrip, setDisplayedTrip: storeMock.setDisplayedTrip }),
}));

import { buildSchemaPrompt } from '@/lib/schema-prompt';

import { router } from 'expo-router';

describe('SmartImportSheet — availability gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    availabilityMock.value = { available: false, reason: 'unsupported' };
  });

  it('shows an explanatory alert with a Copy Schema Prompt button when unavailable', async () => {
    const { default: SmartImportSheet } = await import('@/app/smart-import');
    render(<SmartImportSheet />);

    await waitFor(() => expect(alertMock).toHaveBeenCalled());
    const [, message, buttons] = alertMock.mock.calls[0];
    expect(message).toMatch(/unsupported/i);
    const labels = (buttons as { text: string }[]).map((b) => b.text);
    expect(labels).toContain('Copy Schema Prompt');
  });

  it('puts the Schema Prompt on the clipboard and confirms it did', async () => {
    const { default: SmartImportSheet } = await import('@/app/smart-import');
    render(<SmartImportSheet />);

    // The durable on-screen affordance (also wired to the alert's button).
    fireEvent.click(screen.getByText('Copy Schema Prompt'));

    await waitFor(() =>
      expect(clipboardMock.setStringAsync).toHaveBeenCalledWith(buildSchemaPrompt()),
    );
    // A confirmation alert follows the copy so the user knows it landed.
    await waitFor(() =>
      expect(alertMock.mock.calls.some(([title]) => /copied/i.test(String(title)))).toBe(true),
    );
  });

  it('warns instead of confirming when the clipboard write fails', async () => {
    clipboardMock.setStringAsync.mockResolvedValueOnce(false);
    const { default: SmartImportSheet } = await import('@/app/smart-import');
    render(<SmartImportSheet />);

    fireEvent.click(screen.getByText('Copy Schema Prompt'));

    await waitFor(() =>
      expect(alertMock.mock.calls.some(([title]) => /couldn.?t copy/i.test(String(title)))).toBe(true),
    );
    // No false "copied" confirmation on a failed write.
    expect(alertMock.mock.calls.some(([title]) => /copied/i.test(String(title)))).toBe(false);
  });

  it('warns when the clipboard write rejects rather than leaving it unhandled', async () => {
    clipboardMock.setStringAsync.mockRejectedValueOnce(new Error('clipboard unavailable'));
    const { default: SmartImportSheet } = await import('@/app/smart-import');
    render(<SmartImportSheet />);

    fireEvent.click(screen.getByText('Copy Schema Prompt'));

    await waitFor(() =>
      expect(alertMock.mock.calls.some(([title]) => /couldn.?t copy/i.test(String(title)))).toBe(true),
    );
  });

  it('confirms when the copy is triggered from the gate alert button', async () => {
    const { default: SmartImportSheet } = await import('@/app/smart-import');
    render(<SmartImportSheet />);

    await waitFor(() => expect(alertMock).toHaveBeenCalled());
    const [, , buttons] = alertMock.mock.calls[0];
    const copyButton = (buttons as { text: string; onPress?: () => void }[]).find(
      (b) => b.text === 'Copy Schema Prompt',
    );
    await copyButton!.onPress!();

    expect(clipboardMock.setStringAsync).toHaveBeenCalledWith(buildSchemaPrompt());
  });

  it('offers a paste-text input instead of a gate alert when available', async () => {
    availabilityMock.value = { available: true };
    const { default: SmartImportSheet } = await import('@/app/smart-import');
    render(<SmartImportSheet />);

    expect(screen.getByPlaceholderText(/paste/i)).toBeInTheDocument();
    expect(alertMock).not.toHaveBeenCalled();
  });
});

describe('SmartImportSheet — generating a trip from pasted text', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    availabilityMock.value = { available: true };
    smartImportMock.smartImportTrip.mockReset();
  });

  it('structures the pasted document, saves it, and opens it with no review screen', async () => {
    const trip = { id: 'trip-1', title: 'Big Sur Weekend' };
    smartImportMock.smartImportTrip.mockResolvedValue(trip);
    const { default: SmartImportSheet } = await import('@/app/smart-import');
    render(<SmartImportSheet />);

    fireEvent.change(screen.getByPlaceholderText(/paste/i), {
      target: { value: 'Big Sur Aug 14-15. Bixby Bridge.' },
    });
    fireEvent.click(screen.getByText('Import'));

    await waitFor(() =>
      expect(smartImportMock.smartImportTrip).toHaveBeenCalledWith('Big Sur Aug 14-15. Bixby Bridge.'),
    );
    // Saved immediately, opened immediately — no intermediate review surface.
    await waitFor(() => expect(storeMock.addTrip).toHaveBeenCalledWith(trip));
    expect(storeMock.setDisplayedTrip).toHaveBeenCalledWith('trip-1');
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('alerts and saves nothing when generation fails', async () => {
    smartImportMock.smartImportTrip.mockRejectedValue(new Error('This document is too long.'));
    const { default: SmartImportSheet } = await import('@/app/smart-import');
    render(<SmartImportSheet />);

    fireEvent.change(screen.getByPlaceholderText(/paste/i), { target: { value: 'way too long...' } });
    fireEvent.click(screen.getByText('Import'));

    await waitFor(() =>
      expect(alertMock.mock.calls.some(([, msg]) => /too long/i.test(String(msg)))).toBe(true),
    );
    expect(storeMock.addTrip).not.toHaveBeenCalled();
    expect(router.dismissAll).not.toHaveBeenCalled();
  });
});
