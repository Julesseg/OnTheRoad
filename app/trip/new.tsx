import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { saveWallpaper, deleteTrip } from '@/lib/storage';
import { reconcileDays } from '@/lib/trip-days';
import { Trip } from '@/lib/schema';
import { newId } from '@/lib/id';
import { TripForm, TripFormResult } from '@/components/trip-form';

export default function NewTripScreen() {
  const { addTrip } = useTripStore();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit({ title, startDate, endDate, cover }: TripFormResult) {
    setSubmitting(true);
    const id = newId();
    let wallpaperSaved = false;
    try {
      const now = new Date().toISOString();
      const wallpaperUri = cover.kind === 'picked' ? await saveWallpaper(id, cover.uri) : undefined;
      wallpaperSaved = wallpaperUri !== undefined;
      const trip: Trip = {
        id,
        schemaVersion: 3,
        title,
        startDate,
        endDate,
        wallpaperUri,
        days: reconcileDays([], startDate, endDate).days,
        createdAt: now,
        updatedAt: now,
      };
      await addTrip(trip);
      router.back();
    } catch {
      // If the copied wallpaper outlived a failed save, drop the orphaned folder.
      if (wallpaperSaved) deleteTrip(id);
      Alert.alert('Error', 'Failed to save trip. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <TripForm
      heading="New Trip"
      submitLabel="Create"
      autoFocusTitle
      submitting={submitting}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
    />
  );
}
