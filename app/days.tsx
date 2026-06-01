import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { GlassView } from 'expo-glass-effect';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useTripStore } from '@/lib/store';
import { ItineraryPanel } from '@/components/itinerary-panel';
import { effectiveTripId } from '@/lib/active-trip';
import { tripCountdownBadge, approximateDuration, durationUnitWord } from '@/lib/trip-badge';
import { todayString, formatDateRange } from '@/lib/date-utils';

export default function DaysSheet() {
  const {
    trips,
    loadedTrips,
    displayedTripId,
    activeTripId,
    initialized,
    loadTripById,
    importTrip,
    setDisplayedTrip,
  } = useTripStore();
  const colorScheme = useColorScheme();
  const text = colorScheme === 'dark' ? '#fff' : '#111';
  const subtext = colorScheme === 'dark' ? '#aaa' : '#666';

  const today = todayString();
  const tripId = effectiveTripId(displayedTripId, trips, activeTripId, today);
  const summary = tripId ? (trips.find((t) => t.id === tripId) ?? null) : null;
  const trip = summary ? (loadedTrips[summary.id] ?? null) : null;

  useEffect(() => {
    if (summary) loadTripById(summary.id);
  }, [summary?.id]);

  async function onImport() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;
      // Open the freshly imported trip by making it the Displayed Trip.
      const trip = await importTrip(uri);
      setDisplayedTrip(trip.id);
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not import this trip.');
    }
  }

  if (!initialized) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { color: text }]}>No trips yet</Text>
        <Text style={[styles.emptyHint, { color: subtext }]}>
          Create a trip or import one to get started.
        </Text>
        <View style={styles.emptyActions}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push('/trip/new')}
            accessibilityRole="button"
            accessibilityLabel="Create trip"
          >
            <Text style={styles.primaryBtnText}>Create trip</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={onImport}
            accessibilityRole="button"
            accessibilityLabel="Import trip"
          >
            <Text style={styles.secondaryBtnText}>Import</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Badge: "Now" while the trip is in progress, "in N <unit>" before it starts,
  // and "N <unit> ago" after it has ended — the unit coarsens to weeks/months/
  // years so the count stays small and legible (e.g. "in 2 months").
  const badge = tripCountdownBadge(summary, today);
  const duration = badge.kind === 'now' ? null : approximateDuration(badge.days);
  const unitWord = duration ? durationUnitWord(duration) : '';
  const badgeLabel =
    badge.kind === 'before'
      ? `Starts in ${duration!.value} ${unitWord}`
      : badge.kind === 'after'
        ? `Ended ${duration!.value} ${unitWord} ago`
        : 'In progress';

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.badge} accessible accessibilityLabel={badgeLabel}>
          {badge.kind === 'before' && duration ? (
            <>
              <Text style={styles.badgeWord}>in</Text>
              <Text style={styles.badgeNumber}>{duration.value}</Text>
              <Text style={styles.badgeWord}>{unitWord}</Text>
            </>
          ) : badge.kind === 'after' && duration ? (
            <>
              <Text style={styles.badgeNumber}>{duration.value}</Text>
              <Text style={styles.badgeWord}>{unitWord}</Text>
              <Text style={styles.badgeWord}>ago</Text>
            </>
          ) : (
            <Text style={styles.badgeWord}>Now</Text>
          )}
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: text }]}>{summary.title}</Text>
          <Text style={[styles.dates, { color: subtext }]}>
            {formatDateRange(summary.startDate, summary.endDate)}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/trips')}
          accessibilityRole="button"
          accessibilityLabel="Trips"
        >
          <GlassView glassEffectStyle="regular" isInteractive style={styles.tripsButton}>
            <MaterialIcons name="format-list-bulleted" size={28} color="#007AFF" />
          </GlassView>
        </Pressable>
      </View>
    </View>
  );

  if (!trip) {
    return (
      <View style={styles.sheet}>
        {header}
        <ActivityIndicator style={styles.loader} size="large" />
      </View>
    );
  }

  return <ItineraryPanel trip={trip} header={header} />;
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loader: { marginTop: 24 },

  header: { paddingTop: 16, paddingBottom: 4, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerText: { flex: 1 },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWord: { color: '#fff', fontSize: 12, fontWeight: '600', lineHeight: 13 },
  badgeNumber: { color: '#fff', fontSize: 24, fontWeight: '700', lineHeight: 24 },
  tripsButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  dates: { marginTop: 4, fontSize: 14, textAlign: 'center' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyHint: { marginTop: 8, fontSize: 14, textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  primaryBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryBtnText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
});
