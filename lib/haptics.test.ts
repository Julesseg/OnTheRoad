import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the native module so the helper can be exercised in the node test env.
vi.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  impactAsync: vi.fn().mockResolvedValue(undefined),
  selectionAsync: vi.fn().mockResolvedValue(undefined),
}));

import * as Haptics from 'expo-haptics';
import { haptics } from './haptics';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('haptics.notification', () => {
  it('fires a success notification for a success outcome', () => {
    haptics.notification('success');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  it('maps warning and error outcomes to their feedback types', () => {
    haptics.notification('warning');
    haptics.notification('error');
    expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(
      1,
      Haptics.NotificationFeedbackType.Warning,
    );
    expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(
      2,
      Haptics.NotificationFeedbackType.Error,
    );
  });
});

describe('haptics.impact', () => {
  it('defaults to a light impact for a discrete action', () => {
    haptics.impact();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('honors an explicit weight', () => {
    haptics.impact('heavy');
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  });
});

describe('haptics.selection', () => {
  it('fires a selection tick for picking or toggling', () => {
    haptics.selection();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });
});

describe('degradation when haptics are unavailable', () => {
  it('swallows a rejected native promise instead of throwing', () => {
    vi.mocked(Haptics.notificationAsync).mockRejectedValueOnce(new Error('no engine'));
    expect(() => haptics.notification('success')).not.toThrow();
  });

  it('swallows a synchronous native throw instead of propagating it', () => {
    vi.mocked(Haptics.impactAsync).mockImplementationOnce(() => {
      throw new Error('module unavailable');
    });
    expect(() => haptics.impact()).not.toThrow();
  });
});
