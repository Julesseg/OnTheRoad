import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { AppleMaps } from 'expo-maps';

import type { Trip } from '@/lib/schema';
import { tripRouteCoords, routeViewport, type Viewport } from '@/lib/trip-route';

const ACCENT = '#0a7ea4';

export interface TripMapHandle {
  recenter(): void;
}

export const TripMap = forwardRef<TripMapHandle, { trip: Trip | null; viewport?: Viewport }>(
  function TripMap({ trip, viewport: viewportProp }, ref) {
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
    const viewport = viewportProp ?? routeViewport(coords);

    // `cameraPosition` is honored once on mount, so re-fit imperatively whenever
    // the route coords change (e.g. the trip loads after the first null render).
    const mapRef = useRef<AppleMaps.MapView | null>(null);
    const key = coords.map((c) => `${c.lat},${c.lng}`).join(';');
    useEffect(() => {
      mapRef.current?.setCameraPosition(viewport);
    }, [key]);

    // Keep viewport in a ref so recenter() always reads the latest prop value.
    // Manual pans persist until coords change (re-fires the above effect) or
    // the user taps recenter.
    const viewportRef = useRef(viewport);
    viewportRef.current = viewport;

    useImperativeHandle(ref, () => ({
      recenter: () => mapRef.current?.setCameraPosition(viewportRef.current),
    }));

    return (
      <AppleMaps.View
        ref={mapRef}
        style={styles.map}
        cameraPosition={viewport}
        markers={markers}
        polylines={polylines}
      />
    );
  },
);

const styles = StyleSheet.create({
  map: { flex: 1 },
});
