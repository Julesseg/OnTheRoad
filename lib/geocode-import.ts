import { type Coords, parseMapsUrl } from './coords';
import { searchPlaces } from './photon';
import type { Item, Trip } from './schema';

/**
 * Coordinate enrichment for imported trips. The Schema Prompt path (ADR-0012)
 * brings trips in as JSON from an external LLM, which writes
 * [locations](../CONTEXT.md#item) as address text only — it has no way to know
 * real coordinates. Only items that carry `lat`/`lng` render as
 * [Pins](../CONTEXT.md#pin) (`tripLegs`/`tripRouteCoords` both gate on them), so
 * an address-only import lands on the map with no pins until this step fills them.
 *
 * Mirrors ADR-0011's reasoning (kept for the record though superseded): the first
 * Photon result is accepted automatically and every failure is silent — an item
 * that can't be resolved stays address-only as a stable last resort, never retried.
 */

/** Resolves a free-text address (or pasted maps URL / lat,lng pair) to coordinates,
 *  or null when nothing resolves. Injected so the import flow is testable offline. */
export type AddressGeocoder = (address: string) => Promise<Coords | null>;

/**
 * Resolve one address to coordinates — "parse or go through Photon". An address
 * the user pasted as a maps URL or a raw "lat, lng" pair is parsed offline first
 * ({@link parseMapsUrl}), saving a needless network round trip; anything else is
 * geocoded through Photon, taking its first (best) hit. A blank result or a failed
 * request resolves null — the caller keeps the item address-only.
 */
export async function geocodeAddress(
  address: string,
  searchImpl: typeof searchPlaces = searchPlaces,
): Promise<Coords | null> {
  const offline = parseMapsUrl(address);
  if (offline) return offline;
  try {
    const results = await searchImpl(address);
    return results[0]?.coords ?? null;
  } catch {
    // Offline or Photon error: silent, the item stays address-only (ADR-0011).
    return null;
  }
}

/** An item that carries an address but no pin yet — the only kind this step touches. */
function needsGeocode(item: Item): item is Item & { location: { address: string } } {
  const loc = item.location;
  return !!loc?.address && (loc.lat == null || loc.lng == null);
}

export interface GeocodeTripOptions {
  /** Resolves an address to coordinates; defaults to {@link geocodeAddress}. Injected for tests. */
  geocode?: AddressGeocoder;
}

/**
 * Fill in coordinates for every address-only item in a trip and return the
 * enriched copy (the input is left untouched). Lookups run one at a time in
 * itinerary order: Photon is a shared public service, so a whole trip's worth of
 * addresses must not burst it (the same one-at-a-time stance as `resolveLegs`,
 * ADR-0009). Items that already have a pin, or carry no address, are skipped with
 * no call; items that fail to resolve are left address-only. When nothing resolves
 * the original trip object is returned unchanged.
 */
export async function geocodeTripLocations(
  trip: Trip,
  options: GeocodeTripOptions = {},
): Promise<Trip> {
  const geocode = options.geocode ?? ((address: string) => geocodeAddress(address));
  let changed = false;
  const days = [];
  for (const day of trip.days) {
    const items: Item[] = [];
    for (const item of day.items) {
      if (needsGeocode(item)) {
        const coords = await geocode(item.location.address);
        if (coords) {
          changed = true;
          items.push({ ...item, location: { ...item.location, lat: coords.lat, lng: coords.lng } });
          continue;
        }
      }
      items.push(item);
    }
    days.push({ ...day, items });
  }
  return changed ? { ...trip, days } : trip;
}
