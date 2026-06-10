// Test-only stub for the native `expo-maps` module. Aliased in vitest.config.ts so
// jsdom-based UI tests can render <AppleMaps.View /> without pulling in any native
// or Expo runtime bindings. The DOM proxy turns DOM clicks into onMapClick events,
// exposing pin coords via `clientX`/`clientY` so tests can drive the picker. The
// ref exposes `setCameraPosition` so consumers that drive the camera imperatively
// (the native API treats `cameraPosition` as initial-only) can be unit-tested.
import React, { forwardRef, useImperativeHandle, useState } from 'react';

type Coords = { latitude?: number; longitude?: number };
type Camera = { coordinates?: Coords; zoom?: number };

interface MapMarker {
  coordinates?: Coords;
  tintColor?: string;
}

interface MapPolyline {
  coordinates?: Coords[];
  color?: string;
}

interface MapViewProps {
  cameraPosition?: Camera;
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  onMapClick?: (event: { coordinates: { latitude: number; longitude: number } }) => void;
  style?: unknown;
}

export interface AppleMapsViewHandle {
  setCameraPosition: (config?: Camera) => void;
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

const View = forwardRef<AppleMapsViewHandle, MapViewProps>(function View(props, ref) {
  const [camera, setCamera] = useState<Camera | undefined>(props.cameraPosition);

  useImperativeHandle(ref, () => ({
    setCameraPosition: (config?: Camera) => setCamera(config),
  }));

  const center = camera?.coordinates;
  const zoom = camera?.zoom;
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
    'data-marker-tints': props.markers?.map((m) => m.tintColor ?? '').join(';') ?? '',
    'data-polyline': pairsToString(polyline),
    'data-polyline-color': props.polylines?.[0]?.color ?? '',
    'data-polylines': props.polylines?.map((p) => pairsToString(p.coordinates)).join('|') ?? '',
    'data-polyline-colors': props.polylines?.map((p) => p.color ?? '').join(';') ?? '',
    onClick: (e: { clientX?: number; clientY?: number }) => {
      const latitude = e.clientX ?? 12.34;
      const longitude = e.clientY ?? 56.78;
      props.onMapClick?.({ coordinates: { latitude, longitude } });
    },
  });
});

export const AppleMaps = { View };
export const GoogleMaps = { View };

export const requestPermissionsAsync = async () => ({ status: 'denied', granted: false });
export const getPermissionsAsync = async () => ({ status: 'denied', granted: false });
export const useLocationPermissions = () => [{ status: 'denied', granted: false }, async () => {}];
