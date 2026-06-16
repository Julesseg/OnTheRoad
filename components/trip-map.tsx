import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { AppleMaps } from 'expo-maps';

import type { Trip } from '@/lib/schema';
import { routeViewport, type Viewport } from '@/lib/trip-route';
import { panelLatShift } from '@/lib/framed-viewport';
import { EmberPalette } from '@/constants/theme';

const ACCENT = EmberPalette.coral;
const DIMMED = '#8E8E93';

export interface CenterOnOptions {
  zoom?: number;
  // Lifts the point into the area the day sheet leaves visible, matching the
  // route framing at the current detent.
  panelFraction?: number;
}

export interface TripMapHandle {
  recenter(): void;
  centerOn(coordinates: { latitude: number; longitude: number }, options?: CenterOnOptions): void;
}

// Zoom used when centring on a point (the user's own location or a tapped pin) —
// street level, like the native my-location button.
const CENTER_ON_ZOOM = 14;

export const TripMap = forwardRef<
  TripMapHandle,
  {
    trip: Trip | null;
    viewport?: Viewport;
    activeDate?: string;
    // Shows the traveller's own position as the standard blue dot once when-in-use
    // location permission is granted.
    showUserLocation?: boolean;
    // A trip pin was tapped (its item id) / empty map was tapped. The info card is
    // owned by the screen so it can sit above the day sheet and follow its detent.
    onSelectPin?: (id: string) => void;
    onDeselect?: () => void;
  }
>(
  function TripMap(
    { trip, viewport: viewportProp, activeDate, showUserLocation, onSelectPin, onDeselect },
    ref,
  ) {
    // Same coords and order as tripRouteCoords, but keeps each pin's id and day so
    // a tapped marker resolves back to its item and off-day pins can be dimmed.
    const entries = trip
      ? trip.days.flatMap((day) =>
          day.items
            .filter((i) => i.location?.lat != null && i.location?.lng != null)
            .map((i) => ({ id: i.id, lat: i.location!.lat!, lng: i.location!.lng!, date: day.date })),
        )
      : [];
    const coords = entries;
    const markers = entries.map((c) => ({
      id: c.id,
      coordinates: { latitude: c.lat, longitude: c.lng },
      tintColor: activeDate && c.date !== activeDate ? DIMMED : ACCENT,
      systemImage: 'mappin',
    }));
    // Split the route into runs of same-colored segments: a leg keeps the accent
    // only when both endpoints are on the active date; with no activeDate the
    // merge yields the single accent polyline as before.
    const segments: { coordinates: { latitude: number; longitude: number }[]; color: string }[] =
      [];
    for (let i = 0; i < entries.length - 1; i++) {
      const a = entries[i];
      const b = entries[i + 1];
      const color =
        !activeDate || (a.date === activeDate && b.date === activeDate) ? ACCENT : DIMMED;
      const last = segments[segments.length - 1];
      if (last && last.color === color) {
        last.coordinates.push({ latitude: b.lat, longitude: b.lng });
      } else {
        segments.push({
          coordinates: [
            { latitude: a.lat, longitude: a.lng },
            { latitude: b.lat, longitude: b.lng },
          ],
          color,
        });
      }
    }
    const polylines = segments.map((s) => ({ ...s, width: 3 }));
    const viewport = viewportProp ?? routeViewport(coords);

    // The prop only sets the initial camera; all later moves go through the ref's
    // setCameraPosition, which animates natively (withAnimation) — prop-driven
    // repositioning snaps instead.
    const [initialViewport] = useState(viewport);

    // Re-fit whenever the effective viewport values change: trip load after the
    // first null render, itinerary edits, or the today filter reframing the route.
    // Keyed on values, not identity, so unrelated re-renders preserve manual pans.
    const mapRef = useRef<AppleMaps.MapView | null>(null);
    const key = JSON.stringify(viewport);
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
      centerOn: (coordinates, options) => {
        const zoom = options?.zoom ?? CENTER_ON_ZOOM;
        const latShift = panelLatShift(zoom, options?.panelFraction ?? 0);
        mapRef.current?.setCameraPosition({
          coordinates: { latitude: coordinates.latitude - latShift, longitude: coordinates.longitude },
          zoom,
        });
      },
    }));

    return (
      <AppleMaps.View
        ref={mapRef}
        style={styles.map}
        cameraPosition={initialViewport}
        markers={markers}
        polylines={polylines}
        // The map is a view onto the trip, not a place browser: tapping a non-trip
        // POI must not open MapKit's place card. POI labels stay visible as context.
        properties={{ selectionEnabled: false, isMyLocationEnabled: !!showUserLocation }}
        // The custom themed center-on-user button replaces the native one, which
        // can't be tinted — hide it so the two aren't redundant.
        uiSettings={{ myLocationButtonEnabled: false }}
        onMarkerClick={(e) => (e.id ? onSelectPin?.(e.id) : undefined)}
        onMapClick={() => onDeselect?.()}
      />
    );
  },
);

const styles = StyleSheet.create({
  map: { flex: 1 },
});
