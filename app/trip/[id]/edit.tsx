import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { saveWallpaper, wallpaperDisplayUri } from '@/lib/storage';
import { reconcileDays, type DateEditMode } from '@/lib/trip-days';
import { beginDateEdit } from '@/lib/date-edit-store';
import { TripForm, TripFormResult } from '@/components/trip-form';

export default function EditTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loadedTrips, loadTripById, updateTrip } = useTripStore();
  const [submitting, setSubmitting] = useState(false);
  // The staged span + mode from the date screen — null until the user actually
  // changes the dates, in which case the trip's own span stands and a save is a
  // harmless name/cover edit. Mode drives how items move (ADR-0013).
  const [staged, setStaged] = useState<{
    startDate: string;
    endDate: string;
    mode: DateEditMode;
  } | null>(null);

  useEffect(() => {
    if (id) loadTripById(id);
  }, [id]);

  const trip = loadedTrips[id] ?? null;
  // The span the form shows: the staged edit if any, otherwise the trip's own.
  const span = staged ?? (trip ? { startDate: trip.startDate, endDate: trip.endDate } : null);

  async function handleSubmit(result: TripFormResult) {
    if (!trip || !span) return;
    setSubmitting(true);
    try {
      // A pure name/cover edit (dates untouched, staged null) reconciles
      // harmlessly; an actual date change carries items per the chosen mode and
      // never deletes one.
      const days = reconcileDays(trip.days, span.startDate, span.endDate, staged?.mode ?? 'adjust');
      const wallpaperUri =
        result.cover.kind === 'picked'
          ? await saveWallpaper(trip.id, result.cover.uri)
          : result.cover.kind === 'existing'
            ? trip.wallpaperUri
            : undefined; // 'none' removes the cover photo
      updateTrip({
        ...trip,
        title: result.title,
        startDate: span.startDate,
        endDate: span.endDate,
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

  function openDateScreen(current: { startDate: string; endDate: string }) {
    // Stage the result back into local state; persistence waits for Save.
    beginDateEdit((next) => setStaged(next));
    router.push({
      pathname: '/trip/[id]/dates',
      params: { id, startDate: current.startDate, endDate: current.endDate },
    });
  }

  return (
    <View style={styles.container}>
      {!trip || !span ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <TripForm
          heading="Edit Trip"
          submitLabel="Save"
          initialTitle={trip.title}
          initialStartDate={span.startDate}
          initialEndDate={span.endDate}
          initialWallpaperUri={
            trip.wallpaperUri ? wallpaperDisplayUri(trip.wallpaperUri) : undefined
          }
          onEditDates={openDateScreen}
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
