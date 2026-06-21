// Test-only stub for the native `expo-maps` module. Aliased in vitest.config.ts so
// jsdom-based UI tests can render <AppleMaps.View /> without pulling in any native
// or Expo runtime bindings. The DOM proxy turns DOM clicks into onMapClick events,
// exposing pin coords via `clientX`/`clientY` so tests can drive the picker. The
// ref exposes `setCameraPosition` so consumers that drive the camera imperatively
// (the native API treats `cameraPosition` as initial-only) can be unit-tested.
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

type Coords = { latitude?: number; longitude?: number };
type Camera = { coordinates?: Coords; zoom?: number };

interface MapMarker {
  id?: string;
  coordinates?: Coords;
  tintColor?: string;
}

interface MapPolyline {
  coordinates?: Coords[];
  color?: string;
  width?: number;
}

interface MapProperties {
  isMyLocationEnabled?: boolean;
  selectionEnabled?: boolean;
}

interface MapUiSettings {
  myLocationButtonEnabled?: boolean;
}

interface MapViewProps {
  cameraPosition?: Camera;
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  properties?: MapProperties;
  uiSettings?: MapUiSettings;
  onMapClick?: (event: { coordinates: { latitude: number; longitude: number } }) => void;
  onMarkerClick?: (event: { id?: string }) => void;
  onMapLoaded?: () => void;
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

  // Mirror the native GoogleMaps.View, which fires onMapLoaded once the map is
  // ready. Consumers gate imperative setCameraPosition on this (the native
  // CameraUpdateFactory isn't initialized until load). AppleMaps doesn't pass it.
  useEffect(() => {
    props.onMapLoaded?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const center = camera?.coordinates;
  const zoom = camera?.zoom;
  const markerCoords =
    props.markers?.map((m) => m.coordinates).filter((c): c is Coords => !!c) ?? [];
  const marker = markerCoords[0];
  const polyline = props.polylines?.[0]?.coordinates;
  // Render each marker as a nested element so tests can click an individual pin.
  // The click stops propagation so it fires onMarkerClick only (not the map's
  // onMapClick), mirroring the native behaviour where a marker tap is distinct.
  const markerEls = (props.markers ?? []).map((m, i) =>
    React.createElement('button', {
      key: m.id ?? i,
      'data-testid': `map-marker-${m.id ?? i}`,
      'data-marker-id': m.id ?? '',
      onClick: (e: { stopPropagation?: () => void }) => {
        e.stopPropagation?.();
        props.onMarkerClick?.({ id: m.id });
      },
    }),
  );
  return React.createElement(
    'div',
    {
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
    'data-polyline-widths':
      props.polylines?.map((p) => (p.width === undefined ? '' : String(p.width))).join(';') ?? '',
    'data-selection-enabled':
      props.properties?.selectionEnabled === undefined
        ? ''
        : String(props.properties.selectionEnabled),
    'data-my-location-enabled':
      props.properties?.isMyLocationEnabled === undefined
        ? ''
        : String(props.properties.isMyLocationEnabled),
    'data-my-location-button-enabled':
      props.uiSettings?.myLocationButtonEnabled === undefined
        ? ''
        : String(props.uiSettings.myLocationButtonEnabled),
    onClick: (e: { clientX?: number; clientY?: number }) => {
      const latitude = e.clientX ?? 12.34;
      const longitude = e.clientY ?? 56.78;
      props.onMapClick?.({ coordinates: { latitude, longitude } });
    },
    },
    ...markerEls,
  );
});

export const AppleMaps = { View };
export const GoogleMaps = { View };

export const requestPermissionsAsync = async () => ({ status: 'denied', granted: false });
export const getPermissionsAsync = async () => ({ status: 'denied', granted: false });
export const useLocationPermissions = () => [{ status: 'denied', granted: false }, async () => {}];
