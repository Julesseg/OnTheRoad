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

// Coordinate-bearing fragments of Apple/Google Maps share URLs, most precise first.
const URL_PATTERNS = [
  // Apple `?ll=`/`?q=`/`?daddr=` and Google `?q=`/`?ll=` query params (an explicit pin).
  /[?&](?:ll|q|daddr)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  // Google place coordinates in the data block: `!3d<lat>!4d<lng>` — the dropped pin.
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  // Google map-center / place URLs: `@lat,lng` — the viewport centre, least precise.
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
];

/**
 * Parse coordinates from an Apple/Google Maps share URL or a raw "lat,lng" pair.
 *
 * Pure and offline: returns null for garbage strings and for shortened links
 * (e.g. `maps.app.goo.gl/…`, `goo.gl/maps/…`) whose coordinates only appear after a
 * network redirect. Use {@link resolveMapsUrl} to follow that redirect.
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

/**
 * Resolve coordinates from any pasted value, following one network redirect when needed.
 *
 * Google's Share button (and the iOS share sheet) yield a short link like
 * `maps.app.goo.gl/…` that carries no coordinates until it redirects to the full place
 * URL. When offline parsing fails on an http(s) link we fetch it and parse coordinates
 * from the resolved URL, falling back to the response body. Returns null if nothing
 * parses or the request fails — callers surface that as the usual "couldn't read" error.
 */
export async function resolveMapsUrl(
  input: string | null | undefined,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<Coords | null> {
  const direct = parseMapsUrl(input);
  if (direct) return direct;

  if (typeof input !== 'string' || !/^https?:\/\//i.test(input.trim())) return null;

  try {
    const res = await fetchImpl(input.trim());
    return parseMapsUrl(res.url) ?? parseMapsUrl(await res.text());
  } catch {
    return null;
  }
}
