import { describe, it, expect, vi } from 'vitest';

import { geocodeAddress, resolveTripAddressCoords, applyResolvedCoords } from './geocode';
import type { Trip } from './schema';

// A Photon fetch double: resolves the given features as a successful response.
function photonFetchReturning(features: unknown[]) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features }) });
}

const PIKE_FEATURE = {
  geometry: { coordinates: [-122.3422, 47.6097] },
  properties: { name: 'Pike Place Market', city: 'Seattle', country: 'US' },
};

describe('geocodeAddress', () => {
  it('resolves to the first Photon result’s coordinates', async () => {
    const fetchImpl = photonFetchReturning([PIKE_FEATURE]);
    const coords = await geocodeAddress('pike place', { fetchImpl });
    expect(coords).toEqual({ lat: 47.6097, lng: -122.3422 });
  });

  it('resolves null when Photon returns no results', async () => {
    const fetchImpl = photonFetchReturning([]);
    expect(await geocodeAddress('nowhere at all', { fetchImpl })).toBeNull();
  });

  it('resolves null when the request fails rather than throwing', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    expect(await geocodeAddress('pike place', { fetchImpl })).toBeNull();
  });
});

// A trip with a mix of item shapes: address-only, fully-coordinated, and no
// location at all — only the first kind should be geocoded.
function tripFixture(): Trip {
  return {
    id: 'trip-1',
    schemaVersion: 3,
    title: 'Coast',
    startDate: '2026-07-01',
    endDate: '2026-07-01',
    days: [
      {
        id: 'day-1',
        date: '2026-07-01',
        items: [
          { id: 'addr-only', name: 'Diner', category: 'meal', location: { address: '123 Main St' } },
          {
            id: 'has-coords',
            name: 'Lookout',
            category: 'location',
            location: { address: 'Cliff Rd', lat: 1, lng: 2 },
          },
          { id: 'no-location', name: 'Rest', category: 'note' },
        ],
      },
    ],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

describe('resolveTripAddressCoords', () => {
  it('geocodes only address-only items, keyed by item id', async () => {
    const geocode = vi.fn(async () => ({ lat: 10, lng: 20 }));
    const resolved = await resolveTripAddressCoords(tripFixture(), geocode);

    expect(resolved).toEqual({ 'addr-only': { lat: 10, lng: 20 } });
    expect(geocode).toHaveBeenCalledTimes(1);
    expect(geocode).toHaveBeenCalledWith('123 Main St');
  });

  it('omits items whose address fails to geocode (they stay address-only)', async () => {
    const geocode = vi.fn(async () => null);
    const resolved = await resolveTripAddressCoords(tripFixture(), geocode);
    expect(resolved).toEqual({});
  });

  it('never runs more than the concurrency cap of geocodes at once', async () => {
    // Many address-only items so the cap is observable.
    const trip: Trip = {
      ...tripFixture(),
      days: [
        {
          id: 'day-1',
          date: '2026-07-01',
          items: Array.from({ length: 9 }, (_, i) => ({
            id: `i${i}`,
            name: `Stop ${i}`,
            category: 'activity' as const,
            location: { address: `addr ${i}` },
          })),
        },
      ],
    };

    let inFlight = 0;
    let peak = 0;
    const geocode = vi.fn(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 0));
      inFlight--;
      return { lat: 1, lng: 1 };
    });

    await resolveTripAddressCoords(trip, geocode, 3);
    expect(geocode).toHaveBeenCalledTimes(9);
    expect(peak).toBeLessThanOrEqual(3);
  });
});

describe('applyResolvedCoords', () => {
  it('writes resolved coords into matching items, leaving others untouched', () => {
    const trip = tripFixture();
    const next = applyResolvedCoords(trip, { 'addr-only': { lat: 10, lng: 20 } });

    const item = next.days[0].items.find((i) => i.id === 'addr-only');
    expect(item?.location).toEqual({ address: '123 Main St', lat: 10, lng: 20 });
    // Untouched items keep their identity.
    expect(next.days[0].items[1]).toBe(trip.days[0].items[1]);
  });

  it('returns the same trip reference when there is nothing to apply', () => {
    const trip = tripFixture();
    expect(applyResolvedCoords(trip, {})).toBe(trip);
  });
});
