import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Expo's async-require setup branches on __DEV__; default it to false in tests so the
// jsdom path doesn't try to wire up Fast Refresh / HMR sockets.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

afterEach(() => {
  cleanup();
});
