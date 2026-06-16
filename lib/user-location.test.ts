import { describe, it, expect, vi } from 'vitest';
import { centerOnUser, requestUserLocationPermission, type LocationGateway } from './user-location';

function gateway(overrides: Partial<LocationGateway> = {}): LocationGateway {
  return {
    getForegroundPermissionsAsync: vi.fn().mockResolvedValue({ granted: false, canAskAgain: true }),
    requestForegroundPermissionsAsync: vi.fn().mockResolvedValue({ granted: false }),
    getCurrentPositionAsync: vi.fn().mockResolvedValue({ coords: { latitude: 1, longitude: 2 } }),
    ...overrides,
  };
}

describe('requestUserLocationPermission', () => {
  it('returns true without prompting when permission is already granted', async () => {
    const g = gateway({
      getForegroundPermissionsAsync: vi.fn().mockResolvedValue({ granted: true, canAskAgain: false }),
    });
    expect(await requestUserLocationPermission(g)).toBe(true);
    expect(g.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('prompts and reflects the grant when not yet decided', async () => {
    const g = gateway({
      requestForegroundPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
    });
    expect(await requestUserLocationPermission(g)).toBe(true);
    expect(g.requestForegroundPermissionsAsync).toHaveBeenCalled();
  });

  it('returns false without prompting when it can no longer ask', async () => {
    const g = gateway({
      getForegroundPermissionsAsync: vi.fn().mockResolvedValue({ granted: false, canAskAgain: false }),
    });
    expect(await requestUserLocationPermission(g)).toBe(false);
    expect(g.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('centerOnUser', () => {
  it('resolves to the user position when permission is granted', async () => {
    const g = gateway({
      getForegroundPermissionsAsync: vi.fn().mockResolvedValue({ granted: true, canAskAgain: false }),
      getCurrentPositionAsync: vi.fn().mockResolvedValue({ coords: { latitude: 48.85, longitude: 2.35 } }),
    });
    const result = await centerOnUser(g);
    expect(result).toEqual({ kind: 'located', coordinates: { latitude: 48.85, longitude: 2.35 } });
  });

  it('signals denied — and never reads a position — when permission is refused', async () => {
    const g = gateway({
      getForegroundPermissionsAsync: vi.fn().mockResolvedValue({ granted: false, canAskAgain: false }),
    });
    const result = await centerOnUser(g);
    expect(result).toEqual({ kind: 'denied' });
    expect(g.getCurrentPositionAsync).not.toHaveBeenCalled();
  });
});
