import { describe, it, expect, vi, beforeEach } from 'vitest';

// Platform-dependent maps behaviour (ADR-0015). These tests drive the Android
// branch by stubbing react-native's Platform.OS + Linking, since the lib test env
// otherwise reports Platform.OS === 'web'.
const canOpenURL = vi.fn();
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Linking: { canOpenURL: (url: string) => canOpenURL(url) },
}));

const importMaps = async () => {
  vi.resetModules();
  return import('./maps');
};

beforeEach(() => {
  canOpenURL.mockReset();
});

describe('maps on Android', () => {
  it('builds a universal Google Maps directions URL (Android Google Maps ignores comgooglemaps://)', async () => {
    const { buildGoogleMapsUrl } = await importMaps();
    expect(buildGoogleMapsUrl({ coords: { lat: 47.6062, lng: -122.3321 } })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=47.6062,-122.3321',
    );
    expect(buildGoogleMapsUrl({ address: '100 Bridge Way' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=100%20Bridge%20Way',
    );
  });

  it('offers Google Maps (the default) and adds Waze only when it is installed — never Apple', async () => {
    const { getInstalledMapsApps } = await importMaps();
    canOpenURL.mockResolvedValue(true); // waze installed
    expect(await getInstalledMapsApps()).toEqual(['google', 'waze']);

    canOpenURL.mockResolvedValue(false); // waze not installed
    expect(await getInstalledMapsApps()).toEqual(['google']);
  });

  it('never includes Apple Maps in the Android set', async () => {
    const { getInstalledMapsApps } = await importMaps();
    canOpenURL.mockResolvedValue(true);
    expect(await getInstalledMapsApps()).not.toContain('apple');
  });
});
