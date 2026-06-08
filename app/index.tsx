import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTripStore } from '@/lib/store';
import { TripMap, type TripMapHandle } from '@/components/trip-map';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { effectiveTripId } from '@/lib/active-trip';
import { framedViewport } from '@/lib/framed-viewport';
import { tripRouteCoords } from '@/lib/trip-route';
import { todayString } from '@/lib/date-utils';
import { tripCountdownBadge } from '@/lib/trip-badge';
import { todayFilterModel } from '@/lib/today-filter';

// Matches the resting detent of the /days sheet so the route frames into the
// visible top half of the map.
const PANEL_FRACTION = 0.5;

export default function HomeScreen() {
  const { trips, loadedTrips, displayedTripId, activeTripId, todayFilterOverride, initialized, initialize, loadTripById } =
    useTripStore();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized]);

  const today = todayString();
  const tripId = effectiveTripId(displayedTripId, trips, activeTripId, today);
  const summary = tripId ? (trips.find((t) => t.id === tripId) ?? null) : null;
  const trip = summary ? (loadedTrips[summary.id] ?? null) : null;

  useEffect(() => {
    if (summary) loadTripById(summary.id);
  }, [summary?.id]);

  // The /days sheet is permanent. Re-present it whenever the bare map regains
  // focus — once at startup when the store is ready, and again after the trips
  // sheet dismisses the whole stack to switch trips. Each fresh mount snaps the
  // sheet back to its 50% initial detent: react-native-screens applies
  // sheetInitialDetentIndex only on the sheet's first layout (RNSScreen.mm's
  // one-shot _sheetHasInitialDetentSet guard) and exposes no imperative
  // detent setter, so re-presenting is the only way to reset the detent.
  useFocusEffect(
    useCallback(() => {
      if (initialized) router.push('/days');
    }, [initialized]),
  );

  const badge = summary ? tripCountdownBadge(summary, today) : null;
  const filterModel = trip && badge
    ? todayFilterModel(trip.days, badge, todayFilterOverride, today)
    : { canFilter: false, active: false };
  // Frame today's pins when the filter is active, but fall back to the whole
  // route when today has no map-able locations (only activities/accommodations)
  // so the camera never collapses to the empty-coords world view.
  const fullCoords = trip ? tripRouteCoords(trip) : [];
  const todayCoords = trip && filterModel.active
    ? tripRouteCoords({ ...trip, days: trip.days.filter((d) => d.date === today) })
    : fullCoords;
  const coords = todayCoords.length > 0 ? todayCoords : fullCoords;
  const viewport = framedViewport(coords, PANEL_FRACTION);

  // The map is interactive — pan, pinch-zoom, two-finger rotate, and two-finger
  // pitch all activate as a bundle. expo-maps' AppleMaps exposes no per-gesture
  // toggle (AppleMapsUISettings only covers compass/my-location/scale/pitch
  // buttons), so the full standard MapKit gesture set rides along. This is
  // intentional: "interactive map" here means a normal MapKit map.
  const tripMapRef = useRef<TripMapHandle>(null);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <TripMap ref={tripMapRef} trip={trip} viewport={viewport} />
      </View>
      {/* Manual pan/zoom persists across /days sheet re-presents and resets only
          when the route coords change (trip switch or itinerary edit). Recenter
          undoes a manual pan by re-applying the framed viewport. Hidden when no
          trip is loaded so it can't snap the camera to the world-view default. */}
      {trip && (
        <Pressable
          style={[styles.recenterBtn, { top: insets.top + 12 }]}
          onPress={() => tripMapRef.current?.recenter()}
          accessibilityLabel="Recenter"
        >
          <BlurView tint="regular" intensity={80} style={StyleSheet.absoluteFill} />
          <IconSymbol name="scope" size={22} color="#000" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
