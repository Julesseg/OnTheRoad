// Test-only stub for the native `expo-maps` module. Aliased in vitest.config.ts so
// jsdom-based UI tests can render <AppleMaps.View /> without pulling in any native
// or Expo runtime bindings. The DOM proxy turns DOM clicks into onMapClick events,
// exposing pin coords via `clientX`/`clientY` so tests can drive the picker.
import React from 'react';

type Coords = { latitude?: number; longitude?: number };

interface MapMarker {
  coordinates?: Coords;
  tintColor?: string;
}

interface MapPolyline {
  coordinates?: Coords[];
  color?: string;
}

interface MapViewProps {
  cameraPosition?: { coordinates?: Coords; zoom?: number };
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  onMapClick?: (event: { coordinates: { latitude: number; longitude: number } }) => void;
  style?: unknown;
}

function pairsToString(coords: Coords[] | undefined): string {
  if (!coords) return '';
  return coords
    .filter(
      (c): c is { latitude: number; longitude: number } =>
        typeof c.latitude === 'number' && typeof c.longitude === 'number',
    )
    .map((c) => `${c.latitude},${c.longitude}`)
    .join(';');
}

function View(props: MapViewProps) {
  const center = props.cameraPosition?.coordinates;
  const zoom = props.cameraPosition?.zoom;
  const markerCoords =
    props.markers?.map((m) => m.coordinates).filter((c): c is Coords => !!c) ?? [];
  const marker = markerCoords[0];
  const polyline = props.polylines?.[0]?.coordinates;
  return React.createElement('div', {
    'data-testid': 'apple-maps-view',
    'data-center':
      center && typeof center.latitude === 'number' && typeof center.longitude === 'number'
        ? `${center.latitude},${center.longitude}`
        : '',
    'data-zoom': typeof zoom === 'number' ? String(zoom) : '',
    'data-marker':
      marker && typeof marker.latitude === 'number' && typeof marker.longitude === 'number'
        ? `${marker.latitude},${marker.longitude}`
        : '',
    'data-markers': pairsToString(markerCoords),
    'data-marker-tint': props.markers?.[0]?.tintColor ?? '',
    'data-polyline': pairsToString(polyline),
    'data-polyline-color': props.polylines?.[0]?.color ?? '',
    onClick: (e: { clientX?: number; clientY?: number }) => {
      const latitude = e.clientX ?? 12.34;
      const longitude = e.clientY ?? 56.78;
      props.onMapClick?.({ coordinates: { latitude, longitude } });
    },
  });
}

export const AppleMaps = { View };
export const GoogleMaps = { View };

export const requestPermissionsAsync = async () => ({ status: 'denied', granted: false });
export const getPermissionsAsync = async () => ({ status: 'denied', granted: false });
export const useLocationPermissions = () => [{ status: 'denied', granted: false }, async () => {}];
