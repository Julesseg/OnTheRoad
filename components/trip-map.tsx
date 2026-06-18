import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { AppleMaps } from 'expo-maps';

import type { Trip } from '@/lib/schema';
import type { Coords } from '@/lib/coords';
import { routeViewport, type Viewport } from '@/lib/trip-route';
import { legCacheKey } from '@/lib/route-cache';
import { panelLatShift } from '@/lib/framed-viewport';
import { EmberPalette } from '@/constants/theme';

const ACCENT = EmberPalette.coral;
const DIMMED = '#8E8E93';

// A routed leg is drawn solid at full width; a leg with no road geometry — still
// resolving, offline, or a no-drivable-path hop — falls back to the straight line
// drawn thinner so it reads as approximate rather than a real road (ADR-0009).
const ROAD_WIDTH = 3;
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
    // Road-following geometry for resolved legs, keyed by legCacheKey(from, to).
    // A leg present here is drawn along real roads; one absent falls back to the
    // straight line. Computed lazily and cached by the screen (ADR-0009).
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
  }
>(
  function TripMap(
    {
      trip,
      viewport: viewportProp,
      activeDate,
      roadLegs,
      showUserLocation,
      onSelectPin,
      onDeselect,
      dimmed,
      resultPins,
      droppedPin,
      onMapPress,
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
      systemImage: 'mappin',
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
      systemImage: 'mappin',
    }));
    const markers = [...tripMarkers, ...overlayPins];
    // One polyline per leg, so each can follow real roads independently. A leg
    // keeps the accent only when both endpoints are on the active date (else it's
    // dimmed); it draws along its road geometry when resolved, otherwise the
    // straight-line fallback at a thinner approximate width. The route is never
    // missing — a leg always has at least its two endpoints to draw.
    const polylines = [];
    for (let i = 0; i < entries.length - 1; i++) {
      const a = entries[i];
      const b = entries[i + 1];
      const from: Coords = { lat: a.lat, lng: a.lng };
      const to: Coords = { lat: b.lat, lng: b.lng };
      const active = !dimmed && (!activeDate || (a.date === activeDate && b.date === activeDate));
      const road = roadLegs?.[legCacheKey(from, to)];
      const coordinates = (road ?? [from, to]).map((c) => ({ latitude: c.lat, longitude: c.lng }));
      polylines.push({ coordinates, color: active ? ACCENT : DIMMED, width: road ? ROAD_WIDTH : APPROX_WIDTH });
    }
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
        onMapClick={(e) => {
          onDeselect?.();
          const { latitude, longitude } = e.coordinates;
          if (typeof latitude === 'number' && typeof longitude === 'number') {
            onMapPress?.({ lat: latitude, lng: longitude });
          }
        }}
      />
    );
  },
);

const styles = StyleSheet.create({
  map: { flex: 1 },
});
