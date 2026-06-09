import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { newId } from '@/lib/id';
import { ItemEditor } from '@/components/item-editor';
import type { ItemCategory, Item } from '@/lib/schema';
import { ItemCategorySchema } from '@/lib/schema';
import { dayIdForDate } from '@/lib/trip-days';

function asCategory(value: string | string[] | undefined): ItemCategory | undefined {
  const result = ItemCategorySchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export default function ItemEditorScreen() {
  const { id, dayId, itemId, category } = useLocalSearchParams<{
    id: string;
    dayId: string;
    itemId?: string;
    category?: string;
  }>();
  const { loadedTrips, loadTripById, upsertItem, deleteItem, moveItem } = useTripStore();
  const [newItemId] = useState(newId);

  useEffect(() => {
    if (id) loadTripById(id);
  }, [id]);

  const trip = loadedTrips[id] ?? null;
  const day = trip?.days.find((d) => d.id === dayId) ?? null;
  const existing = itemId ? (day?.items.find((i) => i.id === itemId) ?? null) : null;

  // On the create path, a category param primes the picker; on edit it's ignored.
  const initialCategory: ItemCategory | undefined = existing?.category ?? asCategory(category);

  function handleSubmit(item: Item, date: string) {
    upsertItem(id, dayId, item);
    if (date && date !== day!.date) {
      const [y, m, d] = date.split('-').map(Number);
      const targetDayId = dayIdForDate(trip!, new Date(y, m - 1, d, 12, 0, 0));
      if (targetDayId) moveItem(id, dayId, targetDayId, item.id);
    }
    router.back();
  }

  function handleDelete() {
    if (!existing) return;
    Alert.alert('Delete item', `Delete "${existing.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteItem(id, dayId, existing.id);
          router.back();
        },
      },
    ]);
  }

  if (!trip) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }
  if (!day) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>This item could not be found.</Text>
      </View>
    );
  }

  return (
    <ItemEditor
      itemId={existing ? existing.id : newItemId}
      initialItem={existing ?? undefined}
      defaultCategory={initialCategory}
      trip={trip}
      initialDate={day.date}
      onSubmit={handleSubmit}
      onDelete={existing ? handleDelete : undefined}
      onCancel={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#666' },
});
