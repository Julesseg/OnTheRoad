import { z } from 'zod';
import type { Coords } from './coords';

// Cache keys round coordinates to 5 decimal places (~1.1m) so insignificant
// geocoder jitter shares an entry, while any real move of either endpoint yields
// a different key — that key change *is* the cache invalidation (ADR-0009).
function roundCoord(c: Coords): string {
  return `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;
}

/**
 * The cache key for one leg. Direction-sensitive (`from`→`to` differs from the
 * reverse) and tied to both endpoints' coordinates, so a leg is reused only for
 * the exact pair it was computed for and invalidates the moment an endpoint moves.
 */
export function legCacheKey(from: Coords, to: Coords): string {
  return `${roundCoord(from)}->${roundCoord(to)}`;
}

const CoordsSchema = z.object({ lat: z.number(), lng: z.number() });

// The on-device cache file's shape: leg key → the road polyline coordinates.
// Validated on load so a corrupt file degrades to an empty cache (a recompute)
// rather than crashing — the cache is a derived artifact, never source of truth.
export const RouteCacheSchema = z.record(z.string(), z.array(CoordsSchema));

export type RouteCacheData = z.infer<typeof RouteCacheSchema>;

export interface RouteCache {
  get(from: Coords, to: Coords): Coords[] | undefined;
  set(from: Coords, to: Coords, coordinates: Coords[]): void;
  /** The serializable backing data, for persisting to the cache file. */
  data: RouteCacheData;
}

/** An in-memory cache over a (optionally pre-loaded) serializable data record. */
export function makeRouteCache(data: RouteCacheData = {}): RouteCache {
  return {
    data,
    get(from, to) {
      return data[legCacheKey(from, to)];
    },
    set(from, to, coordinates) {
      data[legCacheKey(from, to)] = coordinates;
    },
  };
}
