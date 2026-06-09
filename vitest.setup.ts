import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// react-native aliases to react-native-web in tests, which has no PlatformColor.
// Shim it so native-only color lookups (e.g. UIColor.separatorColor) don't throw.
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, PlatformColor: (...names: string[]) => ({ semantic: names }) };
});

// Expo's async-require setup branches on __DEV__; default it to false in tests so the
// jsdom path doesn't try to wire up Fast Refresh / HMR sockets.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

afterEach(() => {
  cleanup();
});
