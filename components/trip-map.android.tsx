import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GoogleMaps } from 'expo-maps';

import type { Trip } from '@/lib/schema';
import type { Coords } from '@/lib/coords';
import { routeViewport, type Viewport } from '@/lib/trip-route';
import { panelLatShift } from '@/lib/framed-viewport';
import { EmberPalette } from '@/constants/theme';

// Android twin of trip-map.tsx (iOS / AppleMaps). Same TripMapHandle + props
// contract; only the renderer differs — GoogleMaps.View instead of AppleMaps.View
// (ADR-0015). Two notable Android divergences:
//   - Routes are straight legs only. MKDirections is iOS-only and Android has no
//     keyless directions API, so road geometry is never drawn here — every leg is
//     the straight line between its endpoints at the approximate width.
//   - Google markers can't be tinted like SF-Symbol pins, so dimming/accent colour
//     is passed through for parity but degrades to default markers on device.

const ACCENT = EmberPalette.coral;
const DIMMED = '#8E8E93';

// Straight-line legs read as approximate rather than a real road (ADR-0009).
const APPROX_WIDTH = 2;

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
    // Accepted for a shared contract with the iOS variant, but unused on Android:
    // the route is straight-line only (see file header), so road geometry is never
    // drawn here.
    roadLegs?: Record<string, Coords[]>;
    // Shows the traveller's own position as the standard blue dot once when-in-use
    // location permission is granted.
    showUserLocation?: boolean;
    // A trip pin was tapped (its item id) / empty map was tapped. The info card is
    // owned by the screen so it can sit above the day sheet and follow its detent.
    onSelectPin?: (id: string) => void;
    onDeselect?: () => void;
    // Renders the trip's own pins and route greyed, as static context behind the
    // Location Picker's result pins (CONTEXT.md#result-pin).
    dimmed?: boolean;
    // Accent result pins drawn on top of the (greyed) trip — search candidates.
    resultPins?: Coords[];
    // A single accent pin dropped by tapping the map in the Location Picker.
    droppedPin?: Coords | null;
    // A tap on empty map, reported as coordinates so the picker can drop a pin.
    onMapPress?: (coords: Coords) => void;
    // A native map POI ("landmark") was tapped. Providing this enables Google Maps'
    // POI selection so taps are reported; the picker turns them into a result.
    onPoiSelect?: (poi: { name: string | null; coords: Coords }) => void;
  }
>(
  function TripMap(
    {
      trip,
      viewport: viewportProp,
      activeDate,
      showUserLocation,
      onSelectPin,
      onDeselect,
      dimmed,
      resultPins,
      droppedPin,
      onMapPress,
      onPoiSelect,
    },
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
    const tripMarkers = entries.map((c) => ({
      id: c.id,
      coordinates: { latitude: c.lat, longitude: c.lng },
      // The picker greys the whole trip as context; otherwise off-day pins dim.
      tintColor: dimmed || (activeDate && c.date !== activeDate) ? DIMMED : ACCENT,
    }));
    // Accent result pins (search candidates) and the hand-dropped pin layer over
    // the trip's own pins — drawn last so they sit on top.
    const overlayPins = [
      ...(resultPins ?? []).map((p, i) => ({ id: `result-${i}`, lat: p.lat, lng: p.lng })),
      ...(droppedPin ? [{ id: 'dropped', lat: droppedPin.lat, lng: droppedPin.lng }] : []),
    ].map((p) => ({
      id: p.id,
      coordinates: { latitude: p.lat, longitude: p.lng },
      tintColor: ACCENT,
    }));
    const markers = [...tripMarkers, ...overlayPins];
    // One straight polyline per leg, in itinerary order. A leg keeps the accent
    // only when both endpoints are on the active date, else it's dimmed. The route
    // is never missing — a leg always has its two endpoints to draw.
    const polylines = [];
    for (let i = 0; i < entries.length - 1; i++) {
      const a = entries[i];
      const b = entries[i + 1];
      const active = !dimmed && (!activeDate || (a.date === activeDate && b.date === activeDate));
      const coordinates = [
        { latitude: a.lat, longitude: a.lng },
        { latitude: b.lat, longitude: b.lng },
      ];
      polylines.push({ coordinates, color: active ? ACCENT : DIMMED, width: APPROX_WIDTH });
    }
    const viewport = viewportProp ?? routeViewport(coords);

    // The prop only sets the initial camera; all later moves go through the ref's
    // setCameraPosition, which animates natively — prop-driven repositioning snaps.
    const [initialViewport] = useState(viewport);

    // Re-fit whenever the effective viewport values change: trip load after the
    // first null render, itinerary edits, or the today filter reframing the route.
    const mapRef = useRef<GoogleMaps.MapView | null>(null);
    // The native CameraUpdateFactory isn't initialized until the map finishes
    // loading; calling setCameraPosition before then rejects with a one-shot
    // "CameraUpdateFactory is not initialized" error at launch. Gate the re-fit
    // on onMapLoaded — the initial frame is already set by the cameraPosition prop.
    const [mapLoaded, setMapLoaded] = useState(false);

    // setCameraPosition resolves a promise that rejects with a CancellationException
    // when a newer camera move supersedes it (e.g. the load-time re-fit being
    // overtaken by the trip's viewport resolving). That cancellation is expected —
    // swallow it so it doesn't surface as an unhandled-rejection toast at launch.
    const moveCamera = (config: Parameters<GoogleMaps.MapView['setCameraPosition']>[0]) => {
      void Promise.resolve(mapRef.current?.setCameraPosition(config) as unknown).catch(() => {});
    };

    const key = JSON.stringify(viewport);
    useEffect(() => {
      if (!mapLoaded) return;
      moveCamera(viewport);
    }, [key, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keep viewport in a ref so recenter() always reads the latest prop value.
    const viewportRef = useRef(viewport);
    viewportRef.current = viewport;

    useImperativeHandle(ref, () => ({
      recenter: () => moveCamera(viewportRef.current),
      centerOn: (coordinates, options) => {
        const zoom = options?.zoom ?? CENTER_ON_ZOOM;
        const latShift = panelLatShift(zoom, options?.panelFraction ?? 0);
        moveCamera({
          coordinates: { latitude: coordinates.latitude - latShift, longitude: coordinates.longitude },
          zoom,
        });
      },
    }));

    return (
      <GoogleMaps.View
        ref={mapRef}
        style={styles.map}
        cameraPosition={initialViewport}
        onMapLoaded={() => setMapLoaded(true)}
        markers={markers}
        polylines={polylines}
        // The map is a view onto the trip, not a place browser, so POI selection
        // stays off by default. The Location Picker is the exception: passing
        // onPoiSelect turns on selection so tapping a POI ("landmark") is reported.
        properties={{ selectionEnabled: !!onPoiSelect, isMyLocationEnabled: !!showUserLocation }}
        // The custom themed center-on-user button replaces the native one.
        uiSettings={{ myLocationButtonEnabled: false }}
        onMarkerClick={(e) => (e.id ? onSelectPin?.(e.id) : undefined)}
        onMapClick={(e) => {
          onDeselect?.();
          const { latitude, longitude } = e.coordinates;
          if (typeof latitude === 'number' && typeof longitude === 'number') {
            onMapPress?.({ lat: latitude, lng: longitude });
          }
        }}
        onPOIClick={(e) => {
          const { latitude, longitude } = e.coordinates;
          if (typeof latitude === 'number' && typeof longitude === 'number') {
            onPoiSelect?.({ name: e.name ?? null, coords: { lat: latitude, lng: longitude } });
          }
        }}
      />
    );
  },
);

const styles = StyleSheet.create({
  map: { flex: 1 },
});
