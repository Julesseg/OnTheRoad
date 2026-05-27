export type Coords = { lat: number; lng: number };

const PATTERNS = [
  // Apple `?ll=`/`?q=`/`?daddr=` and Google `?q=`/`?ll=` query params.
  /[?&](?:ll|q|daddr)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  // Google map-center / place URLs: `@lat,lng`.
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  // A raw "lat, lng" pair typed by hand.
  /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/,
];

function inRange(lat: number, lng: number): Coords | null {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Parse coordinates from an Apple/Google Maps share URL or a raw "lat,lng" pair.
 *
 * Returns null for garbage strings and for shortened links (e.g. `maps.app.goo.gl/…`,
 * `goo.gl/maps/…`) whose coordinates only resolve after a network redirect — resolving
 * those is out of scope for this pure parser.
 */
export function parseMapsUrl(input: string | null | undefined): Coords | null {
  if (typeof input !== 'string') return null;

  for (const pattern of PATTERNS) {
    const m = input.match(pattern);
    if (m) {
      const coords = inRange(Number(m[1]), Number(m[2]));
      if (coords) return coords;
    }
  }

  return null;
}
