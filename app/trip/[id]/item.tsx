import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { newId } from '@/lib/id';
import { ItemEditor } from '@/components/item-editor';
import type { ItemType } from '@/lib/item-form';
import type { Item } from '@/lib/schema';

const ITEM_TYPES: ItemType[] = ['location', 'accommodation', 'activity', 'note'];

function asItemType(value: string | string[] | undefined): ItemType | undefined {
  return ITEM_TYPES.find((t) => t === value);
}

export default function ItemEditorScreen() {
  const { id, dayId, itemId, type } = useLocalSearchParams<{
    id: string;
    dayId: string;
    itemId?: string;
    type?: string;
  }>();
  const { loadedTrips, loadTripById, upsertItem, deleteItem } = useTripStore();
  const [newItemId] = useState(newId);

  useEffect(() => {
    if (id) loadTripById(id);
  }, [id]);

  const trip = loadedTrips[id] ?? null;
  const day = trip?.days.find((d) => d.id === dayId) ?? null;
  const existing = itemId ? (day?.items.find((i) => i.id === itemId) ?? null) : null;
  const editorType = existing?.type ?? asItemType(type);

  function handleSubmit(item: Item) {
    upsertItem(id, dayId, item);
    router.back();
  }

  function handleDelete() {
    if (!existing) return;
    Alert.alert('Delete item', `Delete "${itemTitle(existing)}"? This can't be undone.`, [
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
  if (!day || !editorType) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>This item could not be found.</Text>
      </View>
    );
  }

  return (
    <ItemEditor
      type={editorType}
      itemId={existing ? existing.id : newItemId}
      initialItem={existing ?? undefined}
      onSubmit={handleSubmit}
      onDelete={existing ? handleDelete : undefined}
      onCancel={() => router.back()}
    />
  );
}

function itemTitle(item: Item): string {
  return item.type === 'note' ? 'this note' : item.name;
}

const styles = StyleSheet.create({
  loader: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#666' },
});
