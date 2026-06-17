import type { Coords } from './coords';
import { searchPlaces, type SearchPlacesOptions } from './photon';
import type { Trip } from './schema';

/** Resolves a plain address to coordinates, or null when it can't. */
export type Geocoder = (address: string) => Promise<Coords | null>;

/** The Smart Import post-save burst fans out at most this many geocodes at once,
 *  matching the `resolveLegs` burst pattern (ADR-0011). */
const GEOCODE_CONCURRENCY = 3;

/**
 * Resolve a plain address to coordinates via Photon, auto-picking the first
 * result (ADR-0011). Geocoding is best-effort: no results or a failed request
 * resolves `null`, never throws — the address stays as the stable last resort.
 */
export async function geocodeAddress(
  address: string,
  options?: SearchPlacesOptions,
): Promise<Coords | null> {
  try {
    const results = await searchPlaces(address, options);
    return results.length ? results[0].coords : null;
  } catch {
    return null;
  }
}

/** Run `fn` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      await fn(items[next++]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Geocode every address-only item in `trip` (an `address` but no `lat`/`lng`),
 * returning resolved coordinates keyed by item id. The fan-out is concurrency-
 * capped (ADR-0011's post-save Smart Import pass); items that fail to resolve are
 * simply absent from the result, so they stay address-only — no retry, no error.
 */
export async function resolveTripAddressCoords(
  trip: Trip,
  geocode: Geocoder = geocodeAddress,
  concurrency: number = GEOCODE_CONCURRENCY,
): Promise<Record<string, Coords>> {
  const targets: { itemId: string; address: string }[] = [];
  for (const day of trip.days) {
    for (const item of day.items) {
      const loc = item.location;
      if (loc?.address && loc.lat == null && loc.lng == null) {
        targets.push({ itemId: item.id, address: loc.address });
      }
    }
  }

  const resolved: Record<string, Coords> = {};
  await mapWithConcurrency(targets, concurrency, async ({ itemId, address }) => {
    const coords = await geocode(address);
    if (coords) resolved[itemId] = coords;
  });
  return resolved;
}

/**
 * Write resolved coordinates into the matching items' `location.lat/lng`, leaving
 * every other item untouched. Pure; returns the same trip reference when there is
 * nothing to apply so callers can skip a needless save.
 */
export function applyResolvedCoords(
  trip: Trip,
  resolved: Record<string, Coords>,
): Trip {
  if (Object.keys(resolved).length === 0) return trip;
  let changed = false;
  const days = trip.days.map((day) => ({
    ...day,
    items: day.items.map((item) => {
      const coords = resolved[item.id];
      if (!coords || !item.location) return item;
      changed = true;
      return { ...item, location: { ...item.location, lat: coords.lat, lng: coords.lng } };
    }),
  }));
  return changed ? { ...trip, days } : trip;
}
