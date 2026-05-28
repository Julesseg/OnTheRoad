import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { AppleMaps } from 'expo-maps';

import type { Trip } from '@/lib/schema';
import { tripRouteCoords, routeViewport } from '@/lib/trip-route';

const ACCENT = '#0a7ea4';

export function TripMap({ trip }: { trip: Trip | null }) {
  const coords = trip ? tripRouteCoords(trip) : [];
  const markers = coords.map((c) => ({
    coordinates: { latitude: c.lat, longitude: c.lng },
    tintColor: ACCENT,
    systemImage: 'mappin',
  }));
  const polylines =
    coords.length >= 2
      ? [
          {
            coordinates: coords.map((c) => ({ latitude: c.lat, longitude: c.lng })),
            color: ACCENT,
            width: 3,
          },
        ]
      : [];
  const viewport = routeViewport(coords);

  // `cameraPosition` is honored once on mount, so re-fit imperatively whenever
  // the route coords change (e.g. the trip loads after the first null render).
  const ref = useRef<AppleMaps.MapView | null>(null);
  const key = coords.map((c) => `${c.lat},${c.lng}`).join(';');
  useEffect(() => {
    ref.current?.setCameraPosition(viewport);
  }, [key]);

  return (
    <AppleMaps.View
      ref={ref}
      style={styles.map}
      cameraPosition={viewport}
      markers={markers}
      polylines={polylines}
    />
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
