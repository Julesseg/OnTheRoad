import { describe, it, expect, vi, beforeEach } from 'vitest';

// react-native aliases to react-native-web in tests, which doesn't implement
// Appearance.setColorScheme; mock the module so the calls are assertable.
vi.mock('react-native', () => ({
  Appearance: { setColorScheme: vi.fn() },
}));

import { Appearance } from 'react-native';
import { applyAppearance } from './appearance';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('applyAppearance', () => {
  it('clears the override (follows the OS) for system', () => {
    applyAppearance('system');
    expect(Appearance.setColorScheme).toHaveBeenCalledWith('unspecified');
  });

  it('forces light app-wide for light', () => {
    applyAppearance('light');
    expect(Appearance.setColorScheme).toHaveBeenCalledWith('light');
  });

  it('forces dark app-wide for dark', () => {
    applyAppearance('dark');
    expect(Appearance.setColorScheme).toHaveBeenCalledWith('dark');
  });
});
