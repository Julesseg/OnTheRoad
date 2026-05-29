import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassView } from 'expo-glass-effect';

import { useTripStore } from '@/lib/store';
import { TripMap } from '@/components/trip-map';
import { DayList } from '@/components/day-list';
import { resolveActiveTrip } from '@/lib/active-trip';
import { framedViewport } from '@/lib/framed-viewport';
import { tripRouteCoords } from '@/lib/trip-route';
import { selectTodayDay } from '@/lib/today';
import { todayString, tripStatus } from '@/lib/date-utils';

const PANEL_FRACTION = 0.67;

export default function HomeScreen() {
  const { trips, loadedTrips, activeTripId, initialized, initialize, loadTripById } =
    useTripStore();
  const colorScheme = useColorScheme();
  const text = colorScheme === 'dark' ? '#fff' : '#111';
  const subtext = colorScheme === 'dark' ? '#aaa' : '#666';

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized]);

  const today = todayString();
  const { tripId } = resolveActiveTrip(trips, activeTripId, today);
  const summary = tripId ? (trips.find((t) => t.id === tripId) ?? null) : null;
  const trip = summary ? (loadedTrips[summary.id] ?? null) : null;

  useEffect(() => {
    if (summary) loadTripById(summary.id);
  }, [summary?.id]);

  if (!initialized) {
    return (
      <View style={styles.container}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <TripMap trip={null} />
        </View>
        <ActivityIndicator style={styles.loader} size="large" />
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={styles.container}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <TripMap trip={null} />
        </View>
        <SafeAreaView style={styles.foreground}>
          <TripsButton />
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: text }]}>No upcoming trips</Text>
            <Text style={[styles.emptyHint, { color: subtext }]}>
              Tap the trips button to create or import a trip.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const coords = trip ? tripRouteCoords(trip) : [];
  const viewport = framedViewport(coords, PANEL_FRACTION);
  const status = tripStatus(summary);
  const isInProgress = status === 'In progress';

  let statusLabel: string;
  if (isInProgress) {
    statusLabel = 'In progress';
  } else {
    const sel = selectTodayDay(
      { startDate: summary.startDate, endDate: summary.endDate, days: trip?.days ?? [] },
      new Date(),
    );
    const days = sel.daysAway ?? 0;
    statusLabel = `Starts in ${days} day${days === 1 ? '' : 's'}`;
  }

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <TripMap trip={trip} viewport={viewport} />
      </View>

      <SafeAreaView style={styles.foreground} edges={['top']}>
        <View style={styles.navRow}>
          <TripsButton />
        </View>

        <ProgressiveBlurHeader>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{statusLabel}</Text>
          </View>
          <Text style={[styles.title, { color: text }]}>{summary.title}</Text>
          <Text style={[styles.dates, { color: subtext }]}>
            {summary.startDate} — {summary.endDate}
          </Text>
        </ProgressiveBlurHeader>

        {trip ? (
          <ScrollView contentContainerStyle={styles.list}>
            <DayList trip={trip} todayDate={isInProgress ? today : undefined} />
          </ScrollView>
        ) : (
          <ActivityIndicator style={styles.loader} size="large" />
        )}
      </SafeAreaView>
    </View>
  );
}

function TripsButton() {
  return (
    <GlassView
      glassEffectStyle="regular"
      isInteractive
      style={styles.tripsButton}
      onTouchEnd={() => {
        // Trips sheet — implemented in a later slice (#41).
      }}
    >
      <Text style={styles.tripsButtonText}>Trips</Text>
    </GlassView>
  );
}

function ProgressiveBlurHeader({ children }: { children: React.ReactNode }) {
  // Approximates a progressive blur using stacked GlassView layers of
  // increasing opacity from top to bottom. A true variable-blur header
  // (masked multi-layer blur) is a visual spike for a follow-up.
  return (
    <View style={styles.headerOuter} pointerEvents="box-none">
      <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFill} />
      <GlassView
        glassEffectStyle="regular"
        style={[StyleSheet.absoluteFill, styles.headerBlurLower]}
      />
      <View style={styles.headerContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  foreground: { flex: 1 },
  loader: { flex: 1 },

  navRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  headerOuter: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerBlurLower: { opacity: 0.6, top: '50%' },
  headerContent: { paddingHorizontal: 20, paddingVertical: 12 },

  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700' },
  dates: { marginTop: 4, fontSize: 14 },

  tripsButton: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tripsButtonText: { fontSize: 15, fontWeight: '600', color: '#007AFF' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyHint: { marginTop: 8, textAlign: 'center' },

  list: { paddingVertical: 8, paddingHorizontal: 16 },
});
