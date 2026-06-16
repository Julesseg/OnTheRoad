import { useEffect, useRef, useState } from 'react';

import type { Coords } from './coords';
import type { Trip } from './schema';
import { makeRouteCache, legCacheKey, type RouteCache } from './route-cache';
import { tripLegs, resolveLegs } from './trip-legs';
import { routeLeg } from './mk-directions';
import { loadRouteCache, saveRouteCache } from './storage';

/**
 * Resolve a trip's [legs](../CONTEXT.md#trip-route) to road-following geometry,
 * keyed by {@link legCacheKey} for the map to draw. Loads the persisted leg cache
 * once, then resolves the trip's legs lazily — cache hits cost nothing and render
 * instantly on relaunch/offline, misses route one leg at a time (so MapKit's burst
 * throttling isn't tripped) and are written back to the cache (ADR-0009).
 *
 * Only routed legs are returned; an unroutable leg is simply absent, which the map
 * draws as the approximate straight-line fallback — the route is never missing.
 */
export function useRoadLegs(trip: Trip | null): Record<string, Coords[]> {
  const [roads, setRoads] = useState<Record<string, Coords[]>>({});
  const cacheRef = useRef<RouteCache | null>(null);

  const legs = trip ? tripLegs(trip) : [];
  // Re-resolve only when the actual leg endpoints change (an itinerary edit or a
  // moved pin), not on every unrelated re-render.
  const legsKey = legs.map((l) => legCacheKey(l.from, l.to)).join('|');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cacheRef.current) cacheRef.current = makeRouteCache(await loadRouteCache());
      const cache = cacheRef.current;
      const resolved = await resolveLegs(legs, routeLeg, cache);
      if (cancelled) return;
      const next: Record<string, Coords[]> = {};
      for (const leg of resolved) {
        if (!leg.approximate) next[legCacheKey(leg.from, leg.to)] = leg.coordinates;
      }
      setRoads(next);
      saveRouteCache(cache.data);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legsKey]);

  return roads;
}
