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

function buildAddress(p: PhotonFeature['properties']): string | undefined {
  if (!p) return undefined;
  const streetLine = [p.housenumber, p.street].filter(Boolean).join(' ');
  const parts = [streetLine, p.city, p.state, p.country].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

function normalize(feature: PhotonFeature): PhotonResult | null {
  const coords = feature.geometry?.coordinates;
  const title = feature.properties?.name;
  if (!coords || !title) return null;
  const [lng, lat] = coords;
  return {
    title,
    coords: { lat, lng },
    address: buildAddress(feature.properties),
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
  const data = (await res.json()) as PhotonResponse;
  const features = data.features ?? [];
  return features
    .map(normalize)
    .filter((r): r is PhotonResult => r !== null);
}
