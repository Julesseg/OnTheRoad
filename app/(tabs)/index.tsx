import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassView } from 'expo-glass-effect';
import { router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { TripSummary } from '@/lib/schema';
import { DayList } from '@/components/day-list';
import { TodayCompanion } from '@/components/today-companion';
import { TripMap } from '@/components/trip-map';
import { selectTodayDay, nextItemId } from '@/lib/today';
import { todayString } from '@/lib/date-utils';
import { useTheme, Palette } from '@/constants/theme';

// The trip shown on Upcoming: the one in progress today, otherwise the next by
// start date. Past trips (endDate before today) are excluded.
function selectCurrentOrNext(trips: TripSummary[]): TripSummary | null {
  const today = todayString();
  return (
    trips
      .filter((t) => t.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null
  );
}

function fmtRange(startDate: string, endDate: string): string {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const a = new Date(sy, sm - 1, sd);
  const b = new Date(ey, em - 1, ed);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameMonth) {
    return `${a.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${b.getDate()}, ${b.getFullYear()}`;
  }
  return `${a.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${b.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${b.getFullYear()}`;
}

export default function UpcomingScreen() {
  const { trips, loadedTrips, initialized, initialize, loadTripById } = useTripStore();
  const colorScheme = useColorScheme();
  const theme = useTheme(colorScheme);

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized]);

  const selected = selectCurrentOrNext(trips);
  const trip = selected ? (loadedTrips[selected.id] ?? null) : null;

  useEffect(() => {
    if (selected) loadTripById(selected.id);
  }, [selected?.id]);

  if (!initialized) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.mapLayer} pointerEvents="none">
          <TripMap trip={null} />
        </View>
        <SafeAreaView style={styles.foreground}>
          <ActivityIndicator style={styles.loader} size="large" />
        </SafeAreaView>
      </View>
    );
  }

  if (!selected) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.mapLayer} pointerEvents="none">
          <TripMap trip={null} />
        </View>
        <SafeAreaView style={styles.foreground}>
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No upcoming trips</Text>
            <Text style={[styles.emptyHint, { color: theme.text2 }]}>
              Create a trip in the Trips tab to get started.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const now = new Date();
  const selection = selectTodayDay(
    { startDate: selected.startDate, endDate: selected.endDate, days: trip?.days ?? [] },
    now,
  );
  const isInProgress = selection.kind === 'today';
  const daysAway = selection.daysAway ?? 0;
  const companionDay = selection.kind === 'today' ? selection.day : undefined;

  const statusLabel = isInProgress
    ? 'In progress'
    : `Starts in ${daysAway} day${daysAway === 1 ? '' : 's'}`;

  const totalDays = trip ? trip.days.length : 0;
  const totalItems = trip ? trip.days.reduce((acc, d) => acc + d.items.length, 0) : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Map background */}
      <View style={styles.mapLayer} pointerEvents="none">
        <TripMap trip={trip} />
      </View>

      <SafeAreaView style={styles.foreground}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header card */}
          <View style={styles.headerWrapper}>
            <GlassView glassEffectStyle="regular" style={styles.headerCard}>
              {/* Status pill */}
              <View style={[styles.statusPill, { backgroundColor: theme.accentSoft }]}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isInProgress ? Palette.statusProgress : theme.accent },
                  ]}
                />
                <Text style={[styles.statusText, { color: theme.accent }]}>{statusLabel}</Text>
              </View>

              <Text style={[styles.tripTitle, { color: theme.text }]}>{selected.title}</Text>
              <Text style={[styles.datesText, { color: theme.text2 }]}>
                {fmtRange(selected.startDate, selected.endDate)} · {totalDays} days
              </Text>
            </GlassView>
          </View>

          {/* Section header */}
          <Text style={[styles.sectionHead, { color: theme.text2 }]}>ITINERARY</Text>

          {!trip ? (
            <ActivityIndicator style={styles.loader} size="large" />
          ) : (
            <>
              {/* Today companion */}
              {companionDay ? (
                <TodayCompanion day={companionDay} highlightId={nextItemId(companionDay, now)} />
              ) : null}

              {/* Day list */}
              <DayList
                trip={trip}
                todayDate={isInProgress ? todayString() : undefined}
                onSelectDay={(dayId) => router.push(`/trip/${trip.id}/day/${dayId}`)}
              />

              {/* Footer */}
              <Text style={[styles.footer, { color: theme.text3 }]}>
                {'Stored on this device · ' + totalDays + ' days · ' + totalItems + ' items planned'}
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 0 },
  foreground: { flex: 1 },
  loader: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  headerWrapper: { marginHorizontal: 16, marginTop: 8 },
  headerCard: {
    padding: 20,
    borderRadius: 22,
    overflow: 'hidden',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    marginBottom: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tripTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  datesText: {
    fontSize: 15,
    marginTop: 6,
  },
  sectionHead: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 10,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyHint: { marginTop: 8, textAlign: 'center' },
  footer: {
    textAlign: 'center',
    marginTop: 28,
    fontSize: 12,
    marginBottom: 120,
  },
});
