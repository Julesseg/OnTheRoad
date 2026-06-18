import type { Coords } from './coords';

export interface PhotonResult {
  title: string;
  coords: Coords;
  address?: string;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

export interface SearchPlacesOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

// The address lines for a feature, most specific first: a street line
// (housenumber + street) then city, state, country.
function addressParts(p: NonNullable<PhotonFeature['properties']>): string[] {
  const streetLine = [p.housenumber, p.street].filter(Boolean).join(' ');
  return [streetLine, p.city, p.state, p.country].filter(Boolean) as string[];
}

function normalize(feature: PhotonFeature): PhotonResult | null {
  const coords = feature.geometry?.coordinates;
  if (!coords) return null;
  const p = feature.properties ?? {};
  const parts = addressParts(p);
  // A named place (business/landmark) titles by its name with the full address
  // beneath. A bare street address has no `name` — Photon returns these for
  // "123 Main St" queries — so it titles by its street line with the locality
  // (city, state, country) beneath, rather than being dropped for lacking a name.
  const title = p.name ?? parts[0];
  if (!title) return null;
  const subtitle = (p.name ? parts : parts.slice(1)).join(', ');
  const [lng, lat] = coords;
  return {
    title,
    coords: { lat, lng },
    address: subtitle || undefined,
  };
}

export async function searchPlaces(
  query: string,
  options: SearchPlacesOptions = {},
): Promise<PhotonResult[]> {
  const { signal, fetchImpl = globalThis.fetch } = options;
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=8`;
  const res = await fetchImpl(url, {
    signal,
    headers: { 'X-Client': 'on-the-road/1.0 (personal)' },
  });
  if (!res.ok) throw new Error(`Photon request failed: ${res.status}`);
  const data = (await res.json()) as PhotonResponse;
  const features = data.features ?? [];
  return features
    .map(normalize)
    .filter((r): r is PhotonResult => r !== null);
}
