import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassView } from 'expo-glass-effect';
import { useLocalSearchParams, router } from 'expo-router';
import * as Sharing from 'expo-sharing';

import { useTripStore } from '@/lib/store';
import { TripMap } from '@/components/trip-map';
import { DayList } from '@/components/day-list';
import { canFavorite } from '@/lib/active-trip';
import { framedViewport } from '@/lib/framed-viewport';
import { tripRouteCoords } from '@/lib/trip-route';
import { selectTodayDay } from '@/lib/today';
import { todayString, tripStatus } from '@/lib/date-utils';
import { exportTripAsFile } from '@/lib/storage';

const PANEL_FRACTION = 0.67;

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips, loadedTrips, activeTripId, loadTripById, setFavorite, removeTrip } =
    useTripStore();
  const colorScheme = useColorScheme();
  const text = colorScheme === 'dark' ? '#fff' : '#111';
  const subtext = colorScheme === 'dark' ? '#aaa' : '#666';

  useEffect(() => {
    if (id) loadTripById(id);
  }, [id]);

  const summary = trips.find((t) => t.id === id) ?? null;
  const trip = loadedTrips[id] ?? null;

  const today = todayString();
  const isFavorite = activeTripId === id;
  const canFav = summary ? canFavorite(summary, today) : false;
  const status = summary ? tripStatus(summary) : null;
  const isInProgress = status === 'In progress';

  const coords = trip ? tripRouteCoords(trip) : [];
  const viewport = framedViewport(coords, PANEL_FRACTION);

  let statusLabel = '';
  if (summary) {
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
  }

  async function onExport() {
    if (!trip) return;
    try {
      const uri = await exportTripAsFile(trip.id);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/json',
          UTI: 'public.json',
          dialogTitle: `Export ${trip.title}`,
        });
      } else {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Could not export this trip.');
    }
  }

  function onDelete() {
    if (!trip) return;
    Alert.alert('Delete trip', `Delete "${trip.title}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeTrip(trip.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <TripMap trip={trip} viewport={viewport} />
      </View>

      <SafeAreaView style={styles.foreground} edges={['top']}>
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={styles.backBtn}>
            <GlassView glassEffectStyle="regular" isInteractive style={styles.glassBtn}>
              <Text style={styles.glassBtnText}>‹ Back</Text>
            </GlassView>
          </Pressable>

          <View style={styles.navRight}>
            {canFav && !isFavorite && (
              <Pressable
                onPress={() => setFavorite(id)}
                accessibilityLabel="Make favorite"
                style={styles.navAction}
              >
                <GlassView glassEffectStyle="regular" isInteractive style={styles.glassBtn}>
                  <Text style={styles.glassBtnText}>☆</Text>
                </GlassView>
              </Pressable>
            )}
            {isFavorite && (
              <GlassView glassEffectStyle="regular" style={styles.glassBtn}>
                <Text style={styles.glassBtnText}>★</Text>
              </GlassView>
            )}
            <Pressable
              onPress={() => Alert.alert('Actions', '', [
                { text: 'Export', onPress: onExport },
                { text: 'Delete', style: 'destructive', onPress: onDelete },
                { text: 'Cancel', style: 'cancel' },
              ])}
              accessibilityLabel="More actions"
              style={styles.navAction}
            >
              <GlassView glassEffectStyle="regular" isInteractive style={styles.glassBtn}>
                <Text style={styles.glassBtnText}>⋯</Text>
              </GlassView>
            </Pressable>
          </View>
        </View>

        {summary && (
          <View style={styles.headerOuter}>
            <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFill} />
            <GlassView
              glassEffectStyle="regular"
              style={[StyleSheet.absoluteFill, styles.headerBlurLower]}
            />
            <View style={styles.headerContent}>
              {statusLabel ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{statusLabel}</Text>
                </View>
              ) : null}
              <Text style={[styles.title, { color: text }]}>{summary.title}</Text>
              <Text style={[styles.dates, { color: subtext }]}>
                {summary.startDate} — {summary.endDate}
              </Text>
            </View>
          </View>
        )}

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

const styles = StyleSheet.create({
  container: { flex: 1 },
  foreground: { flex: 1 },
  loader: { flex: 1 },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backBtn: {},
  navRight: { flexDirection: 'row', gap: 8 },
  navAction: {},

  glassBtn: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  glassBtnText: { fontSize: 15, fontWeight: '600', color: '#007AFF' },

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

  list: { paddingVertical: 8, paddingHorizontal: 16 },
});
