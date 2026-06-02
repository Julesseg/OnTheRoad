import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { saveWallpaper, wallpaperDisplayUri } from '@/lib/storage';
import { reconcileDays } from '@/lib/trip-days';
import { formatDayLabel } from '@/lib/date-utils';
import type { Day, Trip } from '@/lib/schema';
import { TripForm, TripFormResult } from '@/components/trip-form';

export default function EditTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loadedTrips, loadTripById, updateTrip } = useTripStore();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) loadTripById(id);
  }, [id]);

  const trip = loadedTrips[id] ?? null;

  async function persist(base: Trip, result: TripFormResult, days: Day[]) {
    setSubmitting(true);
    try {
      const wallpaperUri =
        result.cover.kind === 'picked'
          ? await saveWallpaper(base.id, result.cover.uri)
          : result.cover.kind === 'existing'
            ? base.wallpaperUri
            : undefined; // 'none' removes the cover photo
      updateTrip({
        ...base,
        title: result.title,
        startDate: result.startDate,
        endDate: result.endDate,
        wallpaperUri,
        days,
        updatedAt: new Date().toISOString(),
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save trip. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(result: TripFormResult) {
    if (!trip) return;
    const { days, droppedDaysWithItems } = reconcileDays(
      trip.days,
      result.startDate,
      result.endDate,
    );

    if (droppedDaysWithItems.length > 0) {
      // Advisory only: name the affected day(s) and point at "Move to day".
      // Items are never relocated automatically.
      const named = droppedDaysWithItems.map((d) => formatDayLabel(d.date)).join(', ');
      Alert.alert(
        'Days with items will be removed',
        `${named} fall outside the new dates but still have items. Move those items to another day first (swipe a day → Move to day), or they'll be deleted.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => persist(trip, result, days),
          },
        ],
      );
      return;
    }

    persist(trip, result, days);
  }

  return (
    <View style={styles.container}>
      {!trip ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <TripForm
          heading="Edit Trip"
          submitLabel="Save"
          initialTitle={trip.title}
          initialStartDate={trip.startDate}
          initialEndDate={trip.endDate}
          initialWallpaperUri={
            trip.wallpaperUri ? wallpaperDisplayUri(trip.wallpaperUri) : undefined
          }
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1 },
});
