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
 * Unwrap Google's EU cookie-consent interstitial — a short link resolves to
 * `consent.google.com/…?continue=<real maps URL>` before the user accepts cookies —
 * to the real maps URL it wraps in `continue=`. Returns the input unchanged when
 * there's no http(s) `continue` target. The wrapped URL is percent-encoded once, which
 * `URLSearchParams.get` decodes, yielding a directly parseable maps URL.
 */
export function unwrapConsentUrl(input: string | null | undefined): string {
  if (typeof input !== 'string') return '';
  try {
    const cont = new URL(input).searchParams.get('continue');
    if (cont && /^https?:\/\//i.test(cont)) return cont;
  } catch {
    // fall through to the input
  }
  return input;
}

// Maps URL params that carry a place name or address (vs. a coordinate pair).
const QUERY_PARAMS = ['q', 'query', 'destination', 'daddr'];

/**
 * Extract a human-readable place query (name or address) from a Maps URL's
 * `q`/`query`/`destination`/`daddr` param, percent-decoded. Returns null when no such
 * param is present or it holds a bare coordinate pair ({@link parseMapsUrl} handles
 * those, and coordinates are no use to a text geocoder).
 *
 * This is the salvage path for Google's short links: they redirect to a
 * `…/maps?q=<address>` URL that carries no coordinates at all, so the only geocodable
 * signal in the resolved target is the address sitting in `q=`.
 */
export function parseMapsQuery(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null;
  // Step past the EU consent interstitial to the maps URL it wraps, if present.
  const target = unwrapConsentUrl(input);
  let params: URLSearchParams;
  try {
    params = new URL(target).searchParams;
  } catch {
    return null;
  }
  for (const key of QUERY_PARAMS) {
    const value = params.get(key)?.trim();
    if (value && !parseLatLng(value)) return value;
  }
  return null;
}

/**
 * Follow one network redirect for an http(s) link, returning the resolved URL and
 * response body. Exposed so the Share layer can both parse coordinates from and
 * geocode the place name out of a short link's resolved target without fetching it
 * twice. Returns null for non-http input or a failed request.
 */
export async function fetchMapsTarget(
  input: string | null | undefined,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ url: string; body: string } | null> {
  if (typeof input !== 'string' || !/^https?:\/\//i.test(input.trim())) return null;
  try {
    const res = await fetchImpl(input.trim());
    return { url: res.url, body: await res.text() };
  } catch {
    return null;
  }
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

  const resolved = await fetchMapsTarget(input, fetchImpl);
  if (!resolved) return null;
  return parseMapsUrl(unwrapConsentUrl(resolved.url)) ?? parseMapsUrl(resolved.body);
}
