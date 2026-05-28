import { describe, it, expect, vi, afterEach } from 'vitest';

import { searchPlaces } from './photon';

afterEach(() => {
  vi.restoreAllMocks();
});

function fetchReturning(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

describe('searchPlaces', () => {
  it('sends the identifying X-Client header on every request', async () => {
    const fetchMock = fetchReturning({ features: [] });
    await searchPlaces('anything', { fetchImpl: fetchMock });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('X-Client')).toBe('on-the-road/1.0 (personal)');
  });

  it('throws when Photon returns a non-OK response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    });
    await expect(searchPlaces('foo', { fetchImpl: fetchMock })).rejects.toThrow();
  });

  it('forwards an AbortSignal to fetch so callers can cancel in-flight requests', async () => {
    const fetchMock = fetchReturning({ features: [] });
    const controller = new AbortController();
    await searchPlaces('foo', { fetchImpl: fetchMock, signal: controller.signal });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
  });

  it('returns no results without fetching when the query is blank', async () => {
    const fetchMock = fetchReturning({ features: [] });

    expect(await searchPlaces('', { fetchImpl: fetchMock })).toEqual([]);
    expect(await searchPlaces('   ', { fetchImpl: fetchMock })).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a Photon GeoJSON FeatureCollection into normalized results', async () => {
    const fetchMock = fetchReturning({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-122.3422, 47.6097] },
          properties: {
            name: 'Pike Place Market',
            city: 'Seattle',
            state: 'Washington',
            country: 'United States',
            street: 'Pike Place',
            housenumber: '85',
          },
        },
      ],
    });

    const results = await searchPlaces('pike place', { fetchImpl: fetchMock });

    expect(results).toEqual([
      {
        title: 'Pike Place Market',
        coords: { lat: 47.6097, lng: -122.3422 },
        address: '85 Pike Place, Seattle, Washington, United States',
      },
    ]);
  });
});
