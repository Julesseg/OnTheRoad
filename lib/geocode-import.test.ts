import { describe, it, expect, vi } from 'vitest';

import { geocodeAddress, geocodeTripLocations } from './geocode-import';
import type { Trip } from './schema';

// A minimal valid-shaped trip; tests poke at item locations only.
function tripWith(items: Trip['days'][number]['items']): Trip {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    schemaVersion: 3,
    title: 'Test trip',
    startDate: '2026-08-01',
    endDate: '2026-08-01',
    days: [{ id: '00000000-0000-0000-0000-0000000000d1', date: '2026-08-01', items }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function item(id: string, location?: Trip['days'][number]['items'][number]['location']) {
  return { id, name: `Item ${id}`, category: 'location' as const, ...(location ? { location } : {}) };
}

describe('geocodeAddress', () => {
  it('parses a raw "lat, lng" pair offline without calling Photon', async () => {
    const search = vi.fn();
    expect(await geocodeAddress('47.6097, -122.3422', search)).toEqual({ lat: 47.6097, lng: -122.3422 });
    expect(search).not.toHaveBeenCalled();
  });

  it('parses a pasted maps URL offline without calling Photon', async () => {
    const search = vi.fn();
    const coords = await geocodeAddress('https://maps.apple.com/?ll=37.77,-122.42', search);
    expect(coords).toEqual({ lat: 37.77, lng: -122.42 });
    expect(search).not.toHaveBeenCalled();
  });

  it('geocodes a plain address through Photon, taking the first result', async () => {
    const search = vi.fn().mockResolvedValue([
      { title: 'Pike Place Market', coords: { lat: 47.6, lng: -122.3 } },
      { title: 'Other', coords: { lat: 1, lng: 2 } },
    ]);
    expect(await geocodeAddress('Pike Place Market, Seattle', search)).toEqual({ lat: 47.6, lng: -122.3 });
    expect(search).toHaveBeenCalledWith('Pike Place Market, Seattle');
  });

  it('returns null when Photon finds nothing', async () => {
    const search = vi.fn().mockResolvedValue([]);
    expect(await geocodeAddress('nowhere at all', search)).toBeNull();
  });

  it('returns null silently when Photon throws (offline / error)', async () => {
    const search = vi.fn().mockRejectedValue(new Error('network down'));
    expect(await geocodeAddress('somewhere', search)).toBeNull();
  });
});

describe('geocodeTripLocations', () => {
  it('fills coordinates for address-only items, in itinerary order', async () => {
    const trip = tripWith([
      item('a', { address: 'Louvre, Paris' }),
      item('b', { address: 'Eiffel Tower, Paris' }),
    ]);
    const geocode = vi
      .fn()
      .mockResolvedValueOnce({ lat: 48.86, lng: 2.34 })
      .mockResolvedValueOnce({ lat: 48.86, lng: 2.29 });

    const out = await geocodeTripLocations(trip, { geocode });

    expect(out.days[0].items[0].location).toEqual({ address: 'Louvre, Paris', lat: 48.86, lng: 2.34 });
    expect(out.days[0].items[1].location).toEqual({ address: 'Eiffel Tower, Paris', lat: 48.86, lng: 2.29 });
    expect(geocode.mock.calls.map((c) => c[0])).toEqual(['Louvre, Paris', 'Eiffel Tower, Paris']);
  });

  it('skips items that already have a pin — no geocode call', async () => {
    const trip = tripWith([item('a', { address: 'Louvre, Paris', lat: 48.86, lng: 2.34 })]);
    const geocode = vi.fn();
    const out = await geocodeTripLocations(trip, { geocode });
    expect(geocode).not.toHaveBeenCalled();
    expect(out).toBe(trip); // nothing changed, original returned
  });

  it('skips items with no location and items with a location but no address', async () => {
    const trip = tripWith([item('a'), item('b', { lat: 48.86, lng: 2.34 })]);
    const geocode = vi.fn();
    await geocodeTripLocations(trip, { geocode });
    expect(geocode).not.toHaveBeenCalled();
  });

  it('leaves an unresolvable item address-only and keeps importing the rest', async () => {
    const trip = tripWith([
      item('a', { address: 'unfindable place' }),
      item('b', { address: 'Louvre, Paris' }),
    ]);
    const geocode = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ lat: 48.86, lng: 2.34 });

    const out = await geocodeTripLocations(trip, { geocode });

    expect(out.days[0].items[0].location).toEqual({ address: 'unfindable place' });
    expect(out.days[0].items[1].location).toEqual({ address: 'Louvre, Paris', lat: 48.86, lng: 2.34 });
  });

  it('does not mutate the input trip', async () => {
    const trip = tripWith([item('a', { address: 'Louvre, Paris' })]);
    const geocode = vi.fn().mockResolvedValue({ lat: 48.86, lng: 2.34 });
    await geocodeTripLocations(trip, { geocode });
    expect(trip.days[0].items[0].location).toEqual({ address: 'Louvre, Paris' });
  });

  it('returns the original trip unchanged when nothing resolves', async () => {
    const trip = tripWith([item('a', { address: 'unfindable' })]);
    const geocode = vi.fn().mockResolvedValue(null);
    const out = await geocodeTripLocations(trip, { geocode });
    expect(out).toBe(trip);
  });
});
