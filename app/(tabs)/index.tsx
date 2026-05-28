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

export default function UpcomingScreen() {
  const { trips, loadedTrips, initialized, initialize, loadTripById } = useTripStore();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized]);

  const selected = selectCurrentOrNext(trips);
  const trip = selected ? (loadedTrips[selected.id] ?? null) : null;

  useEffect(() => {
    if (selected) loadTripById(selected.id);
  }, [selected?.id]);

  const text = colorScheme === 'dark' ? '#fff' : '#111';
  const subtext = colorScheme === 'dark' ? '#aaa' : '#666';

  if (!initialized) {
    return (
      <View style={styles.container}>
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
      <View style={styles.container}>
        <View style={styles.mapLayer} pointerEvents="none">
          <TripMap trip={null} />
        </View>
        <SafeAreaView style={styles.foreground}>
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: text }]}>No upcoming trips</Text>
            <Text style={[styles.emptyHint, { color: subtext }]}>
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

  return (
    <View style={styles.container}>
      <View style={styles.mapLayer} pointerEvents="none">
        <TripMap trip={trip} />
      </View>
      <SafeAreaView style={styles.foreground}>
        <GlassView glassEffectStyle="regular" style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {isInProgress ? 'In progress' : `Starts in ${daysAway} day${daysAway === 1 ? '' : 's'}`}
            </Text>
          </View>
          <Text style={[styles.title, { color: text }]}>{selected.title}</Text>
          <Text style={[styles.dates, { color: subtext }]}>
            {selected.startDate} — {selected.endDate}
          </Text>
        </GlassView>

        {!trip ? (
          <ActivityIndicator style={styles.loader} size="large" />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {companionDay ? (
              <TodayCompanion day={companionDay} highlightId={nextItemId(companionDay, now)} />
            ) : null}
            <DayList
              trip={trip}
              todayDate={isInProgress ? todayString() : undefined}
              onSelectDay={(dayId) => router.push(`/trip/${trip.id}/day/${dayId}`)}
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 0 },
  foreground: { flex: 1 },
  loader: { flex: 1 },
  header: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyHint: { marginTop: 8, textAlign: 'center' },
  list: { paddingVertical: 8, paddingHorizontal: 16 },
});
