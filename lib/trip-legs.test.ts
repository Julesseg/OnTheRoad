import { describe, it, expect, vi } from 'vitest';
import { tripLegs, legActive, resolveLeg, resolveLegs } from './trip-legs';
import { makeRouteCache } from './route-cache';
import type { Trip } from './schema';

function makeTrip(days: Trip['days']): Trip {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    schemaVersion: 3,
    title: 'Test trip',
    startDate: '2099-07-01',
    endDate: '2099-07-02',
    days,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const gg = { lat: 37.8199, lng: -122.4783 };
const bigSur = { lat: 36.2704, lng: -121.8081 };
const hearst = { lat: 35.6852, lng: -121.1685 };

describe('tripLegs', () => {
  it('has no legs for a trip with fewer than two located pins', () => {
    const trip = makeTrip([
      { id: 'd1', date: '2099-07-01', items: [{ category: 'location', id: 'a', name: 'GG', location: gg }] },
    ]);
    expect(tripLegs(trip)).toEqual([]);
  });

  it('joins consecutive located pins, carrying each endpoint date', () => {
    const trip = makeTrip([
      {
        id: 'd1',
        date: '2099-07-01',
        items: [
          { category: 'location', id: 'a', name: 'GG', location: gg },
          { category: 'location', id: 'b', name: 'Big Sur', location: bigSur },
        ],
      },
      {
        id: 'd2',
        date: '2099-07-02',
        items: [{ category: 'location', id: 'c', name: 'Hearst', location: hearst }],
      },
    ]);
    expect(tripLegs(trip)).toEqual([
      { from: gg, to: bigSur, fromDate: '2099-07-01', toDate: '2099-07-01' },
      { from: bigSur, to: hearst, fromDate: '2099-07-01', toDate: '2099-07-02' },
    ]);
  });

  it('skips items without coordinates when pairing', () => {
    const trip = makeTrip([
      {
        id: 'd1',
        date: '2099-07-01',
        items: [
          { category: 'location', id: 'a', name: 'GG', location: gg },
          { category: 'note', id: 'n', name: 'leave early' },
          { category: 'location', id: 'b', name: 'Big Sur', location: bigSur },
        ],
      },
    ]);
    expect(tripLegs(trip)).toEqual([
      { from: gg, to: bigSur, fromDate: '2099-07-01', toDate: '2099-07-01' },
    ]);
  });
});

describe('legActive (day-filter dimming)', () => {
  const leg = { fromDate: '2099-07-01', toDate: '2099-07-01' };

  it('is active when no day filter is set', () => {
    expect(legActive(leg, undefined)).toBe(true);
  });

  it('is active when both endpoints fall on the active day', () => {
    expect(legActive(leg, '2099-07-01')).toBe(true);
  });

  it('is dimmed when an endpoint is off the active day', () => {
    expect(legActive({ fromDate: '2099-07-01', toDate: '2099-07-02' }, '2099-07-01')).toBe(false);
  });
});

describe('resolveLeg', () => {
  const road = [gg, { lat: 37, lng: -122 }, bigSur];

  it('returns the cached road polyline without calling the router', async () => {
    const cache = makeRouteCache();
    cache.set(gg, bigSur, road);
    const router = vi.fn();
    const leg = await resolveLeg(gg, bigSur, router, cache);
    expect(leg).toEqual({ from: gg, to: bigSur, coordinates: road, approximate: false });
    expect(router).not.toHaveBeenCalled();
  });

  it('routes a cache miss, caches it, and marks it not approximate', async () => {
    const cache = makeRouteCache();
    const router = vi.fn().mockResolvedValue(road);
    const leg = await resolveLeg(gg, bigSur, router, cache);
    expect(leg.coordinates).toEqual(road);
    expect(leg.approximate).toBe(false);
    expect(router).toHaveBeenCalledTimes(1);
    expect(cache.get(gg, bigSur)).toEqual(road);
  });

  it('falls back to an approximate straight line when routing returns null', async () => {
    const cache = makeRouteCache();
    const router = vi.fn().mockResolvedValue(null);
    const leg = await resolveLeg(gg, bigSur, router, cache);
    expect(leg).toEqual({ from: gg, to: bigSur, coordinates: [gg, bigSur], approximate: true });
  });

  it('falls back to an approximate straight line when the router throws (offline)', async () => {
    const cache = makeRouteCache();
    const router = vi.fn().mockRejectedValue(new Error('offline'));
    const leg = await resolveLeg(gg, bigSur, router, cache);
    expect(leg.coordinates).toEqual([gg, bigSur]);
    expect(leg.approximate).toBe(true);
  });

  it('does not cache a fallback, so it retries once routing is possible again', async () => {
    const cache = makeRouteCache();
    const failing = vi.fn().mockResolvedValue(null);
    await resolveLeg(gg, bigSur, failing, cache);
    expect(cache.get(gg, bigSur)).toBeUndefined();

    const succeeding = vi.fn().mockResolvedValue(road);
    const leg = await resolveLeg(gg, bigSur, succeeding, cache);
    expect(leg.approximate).toBe(false);
    expect(succeeding).toHaveBeenCalledTimes(1);
  });
});

describe('resolveLegs', () => {
  const road = [gg, { lat: 37, lng: -122 }, bigSur];

  it('resolves each leg in order, routing only the uncached ones', async () => {
    const cache = makeRouteCache();
    cache.set(gg, bigSur, road);
    const router = vi.fn().mockResolvedValue([bigSur, hearst]);
    const legs = await resolveLegs(
      [
        { from: gg, to: bigSur },
        { from: bigSur, to: hearst },
      ],
      router,
      cache,
    );
    expect(legs.map((l) => l.approximate)).toEqual([false, false]);
    expect(legs[0].coordinates).toEqual(road);
    expect(legs[1].coordinates).toEqual([bigSur, hearst]);
    // Only the second leg was a cache miss.
    expect(router).toHaveBeenCalledTimes(1);
  });
});
