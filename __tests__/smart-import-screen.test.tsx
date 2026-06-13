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

const availabilityMock = vi.hoisted(() => ({
  value: { available: false, reason: 'unsupported' } as
    | { available: true }
    | { available: false; reason: string },
}));
vi.mock('@/lib/smart-import-availability', () => ({
  getSmartImportAvailability: () => availabilityMock.value,
  smartImportUnavailableMessage: (reason: string) => `Unavailable because: ${reason}`,
}));

import { buildSchemaPrompt } from '@/lib/schema-prompt';

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

  it('renders the ready placeholder when Smart Import is available, with no gate alert', async () => {
    availabilityMock.value = { available: true };
    const { default: SmartImportSheet } = await import('@/app/smart-import');
    render(<SmartImportSheet />);

    expect(screen.getByText(/ready/i)).toBeInTheDocument();
    expect(alertMock).not.toHaveBeenCalled();
  });
});
