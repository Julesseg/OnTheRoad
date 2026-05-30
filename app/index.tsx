import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { TripMap } from '@/components/trip-map';
import { effectiveTripId } from '@/lib/active-trip';
import { framedViewport } from '@/lib/framed-viewport';
import { tripRouteCoords } from '@/lib/trip-route';
import { todayString } from '@/lib/date-utils';

// Matches the resting detent of the /days sheet so the route frames into the
// visible top half of the map.
const PANEL_FRACTION = 0.5;

export default function HomeScreen() {
  const { trips, loadedTrips, displayedTripId, activeTripId, initialized, initialize, loadTripById } =
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

  // The /days sheet is permanent: present it once the store is ready and
  // re-present it if it ever loses focus (e.g. after returning from a modal).
  const presented = useRef(false);
  useEffect(() => {
    if (initialized && !presented.current) {
      presented.current = true;
      router.push('/days');
    }
  }, [initialized]);

  const coords = trip ? tripRouteCoords(trip) : [];
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
