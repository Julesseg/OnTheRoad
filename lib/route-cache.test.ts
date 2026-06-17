import { describe, it, expect } from 'vitest';
import { legCacheKey, makeRouteCache, RouteCacheSchema } from './route-cache';

describe('legCacheKey', () => {
  it('is stable for the same endpoints', () => {
    const a = { lat: 37.8199, lng: -122.4783 };
    const b = { lat: 36.2704, lng: -121.8081 };
    expect(legCacheKey(a, b)).toBe(legCacheKey(a, b));
  });

  it('distinguishes direction so a reversed leg is a different entry', () => {
    const a = { lat: 37.8199, lng: -122.4783 };
    const b = { lat: 36.2704, lng: -121.8081 };
    expect(legCacheKey(a, b)).not.toBe(legCacheKey(b, a));
  });

  it('changes when an endpoint moves, invalidating the old entry', () => {
    const a = { lat: 37.8199, lng: -122.4783 };
    const b = { lat: 36.2704, lng: -121.8081 };
    const moved = { lat: 36.5, lng: -121.8081 };
    expect(legCacheKey(a, moved)).not.toBe(legCacheKey(a, b));
  });

  it('ignores movement below ~1m so identical pins share an entry', () => {
    const a = { lat: 37.8199, lng: -122.4783 };
    const b = { lat: 36.2704, lng: -121.8081 };
    const jitter = { lat: 36.27040001, lng: -121.80810001 };
    expect(legCacheKey(a, jitter)).toBe(legCacheKey(a, b));
  });
});

describe('makeRouteCache', () => {
  const a = { lat: 37.8199, lng: -122.4783 };
  const b = { lat: 36.2704, lng: -121.8081 };
  const road = [a, { lat: 37, lng: -122 }, b];

  it('returns undefined for an uncached leg', () => {
    const cache = makeRouteCache();
    expect(cache.get(a, b)).toBeUndefined();
  });

  it('returns the coordinates a leg was cached with', () => {
    const cache = makeRouteCache();
    cache.set(a, b, road);
    expect(cache.get(a, b)).toEqual(road);
  });

  it('misses for a moved endpoint, so a stale entry is never served', () => {
    const cache = makeRouteCache();
    cache.set(a, b, road);
    const moved = { lat: 36.5, lng: -121.8081 };
    expect(cache.get(a, moved)).toBeUndefined();
  });
});

describe('persisted cache shape', () => {
  const a = { lat: 37.8199, lng: -122.4783 };
  const b = { lat: 36.2704, lng: -121.8081 };
  const road = [a, { lat: 37, lng: -122 }, b];

  it('survives a JSON round-trip so cached legs render on relaunch', () => {
    const cache = makeRouteCache();
    cache.set(a, b, road);
    const persisted = JSON.parse(JSON.stringify(cache.data));
    const reloaded = makeRouteCache(RouteCacheSchema.parse(persisted));
    expect(reloaded.get(a, b)).toEqual(road);
  });

  it('rejects a corrupt cache file so a bad entry never crashes load', () => {
    expect(RouteCacheSchema.safeParse({ key: 'not-coords' }).success).toBe(false);
  });
});
