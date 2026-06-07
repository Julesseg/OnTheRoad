import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { TripMap } from '@/components/trip-map';
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

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <TripMap trip={trip} viewport={viewport} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
