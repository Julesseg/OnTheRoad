import type { Coords } from './coords';
import type { Trip } from './schema';

export interface Viewport {
  coordinates: { latitude: number; longitude: number };
  zoom: number;
}

export function tripRouteCoords(trip: Trip): Coords[] {
  const out: Coords[] = [];
  for (const day of trip.days) {
    for (const item of day.items) {
      if (item.type === 'location' && typeof item.lat === 'number' && typeof item.lng === 'number') {
        out.push({ lat: item.lat, lng: item.lng });
      }
    }
  }
  return out;
}

export function routeViewport(coords: Coords[]): Viewport {
  if (coords.length === 0) {
    return { coordinates: { latitude: 0, longitude: 0 }, zoom: 1 };
  }
  if (coords.length === 1) {
    return {
      coordinates: { latitude: coords[0].lat, longitude: coords[0].lng },
      zoom: 12,
    };
  }
  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const span = Math.max(maxLat - minLat, maxLng - minLng);
  // Web-Mercator-style zoom that fits `span` degrees on screen with a
  // bit of padding; clamped so dense pins don't zoom past street level
  // and so antipodes don't drop below world view.
  const raw = Math.floor(Math.log2(360 / Math.max(span, 1e-6))) - 1;
  const zoom = Math.max(1, Math.min(14, raw));
  return {
    coordinates: { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2 },
    zoom,
  };
}
