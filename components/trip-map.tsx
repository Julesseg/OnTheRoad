import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppleMaps } from 'expo-maps';

import type { Item, Trip } from '@/lib/schema';
import { routeViewport, type Viewport } from '@/lib/trip-route';
import { findLocatedItem, pinInfoCard, type LocatedItem } from '@/lib/pin-info-card';
import { useThemeColors, EmberPalette } from '@/constants/theme';

const ACCENT = EmberPalette.coral;
const DIMMED = '#8E8E93';

export interface TripMapHandle {
  recenter(): void;
  centerOn(coordinates: { latitude: number; longitude: number }): void;
}

// Zoom used when centring on the user's own location — street level, like the
// native my-location button.
const USER_LOCATION_ZOOM = 14;

export const TripMap = forwardRef<
  TripMapHandle,
  {
    trip: Trip | null;
    viewport?: Viewport;
    activeDate?: string;
    // Shows the traveller's own position as the standard blue dot once when-in-use
    // location permission is granted.
    showUserLocation?: boolean;
    // The info card's actions: open the full item editor, or navigate to it in the
    // preferred maps app. Both optional so the bare map (e.g. tests) can omit them.
    onOpenItem?: (located: LocatedItem) => void;
    onNavigateItem?: (item: Item) => void;
  }
>(
  function TripMap(
    { trip, viewport: viewportProp, activeDate, showUserLocation, onOpenItem, onNavigateItem },
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
      centerOn: (coordinates) =>
        mapRef.current?.setCameraPosition({ coordinates, zoom: USER_LOCATION_ZOOM }),
    }));

    // The tapped pin's item, shown as a floating info card. Tapping another pin
    // replaces it; tapping empty map (onMapClick) dismisses it.
    const c = useThemeColors();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const located = selectedId ? findLocatedItem(trip, selectedId) : null;
    const card = located ? pinInfoCard(located.item) : null;

    return (
      <View style={styles.map}>
        <AppleMaps.View
          ref={mapRef}
          style={styles.map}
          cameraPosition={initialViewport}
          markers={markers}
          polylines={polylines}
          // The map is a view onto the trip, not a place browser: tapping a non-trip
          // POI must not open MapKit's place card. POI labels stay visible as context.
          properties={{ selectionEnabled: false, isMyLocationEnabled: !!showUserLocation }}
          onMarkerClick={(e) => setSelectedId(e.id ?? null)}
          onMapClick={() => setSelectedId(null)}
        />
        {card && located ? (
          // Pinned to the top of the map (below the nav buttons) so it never
          // collides with the day sheet, which lives along the bottom edge.
          <View
            style={[styles.card, { backgroundColor: c.surface, borderColor: c.separator }]}
            accessibilityLabel="Pin info card"
          >
            <View style={styles.cardHeader}>
              <View style={[styles.accentDot, { backgroundColor: card.accent }]} />
              <Text style={[styles.cardName, { color: c.text }]} numberOfLines={1}>
                {card.name}
              </Text>
              {card.time ? (
                <Text style={[styles.cardTime, { color: c.textSubtle }]}>{card.time}</Text>
              ) : null}
            </View>
            {card.notesSnippet ? (
              <Text style={[styles.cardNotes, { color: c.textSubtle }]} numberOfLines={2}>
                {card.notesSnippet}
              </Text>
            ) : null}
            <View style={styles.cardActions}>
              <Pressable
                accessibilityLabel="Open item"
                onPress={() => onOpenItem?.(located)}
                style={styles.cardAction}
              >
                <Text style={[styles.cardActionText, { color: c.accent }]}>Details</Text>
              </Pressable>
              {card.hasLocation ? (
                <Pressable
                  accessibilityLabel="Open in maps"
                  onPress={() => onNavigateItem?.(located.item)}
                  style={styles.cardAction}
                >
                  <Text style={[styles.cardActionText, { color: c.accent }]}>Directions</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  map: { flex: 1 },
  card: {
    position: 'absolute',
    top: 72,
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accentDot: { width: 10, height: 10, borderRadius: 5 },
  cardName: { flex: 1, fontSize: 16, fontWeight: '600' },
  cardTime: { fontSize: 14, fontWeight: '500' },
  cardNotes: { fontSize: 13, lineHeight: 18 },
  cardActions: { flexDirection: 'row', gap: 20, marginTop: 2 },
  cardAction: { paddingVertical: 2 },
  cardActionText: { fontSize: 15, fontWeight: '600' },
});
