export type Coords = { lat: number; lng: number };

function inRange(lat: number, lng: number): Coords | null {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

const RAW_PAIR = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

/**
 * Parse a bare "lat, lng" pair (no surrounding URL), rejecting anything out of
 * geographic range. Shared with the form layer (`item-form.parseCoords`) so the
 * raw-pair grammar and bounds live in exactly one place.
 */
export function parseLatLng(input: string | null | undefined): Coords | null {
  if (typeof input !== 'string') return null;
  const m = input.match(RAW_PAIR);
  return m ? inRange(Number(m[1]), Number(m[2])) : null;
}

// Coordinate-bearing fragments of Apple/Google Maps share URLs.
const URL_PATTERNS = [
  // Apple `?ll=`/`?q=`/`?daddr=` and Google `?q=`/`?ll=` query params.
  /[?&](?:ll|q|daddr)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  // Google map-center / place URLs: `@lat,lng`.
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
];

/**
 * Parse coordinates from an Apple/Google Maps share URL or a raw "lat,lng" pair.
 *
 * Returns null for garbage strings and for shortened links (e.g. `maps.app.goo.gl/…`,
 * `goo.gl/maps/…`) whose coordinates only resolve after a network redirect — resolving
 * those is out of scope for this pure parser.
 */
export function parseMapsUrl(input: string | null | undefined): Coords | null {
  if (typeof input !== 'string') return null;

  for (const pattern of URL_PATTERNS) {
    const m = input.match(pattern);
    if (m) {
      const coords = inRange(Number(m[1]), Number(m[2]));
      if (coords) return coords;
    }
  }

  return parseLatLng(input);
}
