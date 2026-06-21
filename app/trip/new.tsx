import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { saveWallpaper, deleteTrip } from '@/lib/storage';
import { reconcileDays } from '@/lib/trip-days';
import { Trip } from '@/lib/schema';
import { newId } from '@/lib/id';
import { t } from '@/lib/i18n';
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
        days: reconcileDays([], startDate, endDate),
        createdAt: now,
        updatedAt: now,
      };
      await addTrip(trip);
      router.back();
    } catch {
      // If the copied wallpaper outlived a failed save, drop the orphaned folder.
      if (wallpaperSaved) deleteTrip(id);
      Alert.alert(t('tripForm.saveErrorTitle'), t('tripForm.saveErrorBody'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <TripForm
      heading={t('trips.new')}
      submitLabel={t('tripForm.create')}
      autoFocusTitle
      submitting={submitting}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
    />
  );
}
