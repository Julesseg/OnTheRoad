// Test-only stub for the native `expo-maps` module. Aliased in vitest.config.ts so
// jsdom-based UI tests can render <AppleMaps.View /> without pulling in any native
// or Expo runtime bindings. The DOM proxy turns DOM clicks into onMapClick events,
// exposing pin coords via `clientX`/`clientY` so tests can drive the picker.
import React from 'react';

type Coords = { latitude?: number; longitude?: number };

interface MapViewProps {
  cameraPosition?: { coordinates?: Coords };
  markers?: { coordinates?: Coords }[];
  onMapClick?: (event: { coordinates: { latitude: number; longitude: number } }) => void;
  style?: unknown;
}

function View(props: MapViewProps) {
  const center = props.cameraPosition?.coordinates;
  const marker = props.markers?.[0]?.coordinates;
  return React.createElement('div', {
    'data-testid': 'apple-maps-view',
    'data-center':
      center && typeof center.latitude === 'number' && typeof center.longitude === 'number'
        ? `${center.latitude},${center.longitude}`
        : '',
    'data-marker':
      marker && typeof marker.latitude === 'number' && typeof marker.longitude === 'number'
        ? `${marker.latitude},${marker.longitude}`
        : '',
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
