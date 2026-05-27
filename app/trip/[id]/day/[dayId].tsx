import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { useLocalSearchParams, router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { ItemRow } from '@/components/item-row';
import type { Item } from '@/lib/schema';
import type { ItemType } from '@/lib/item-form';

const ADD_OPTIONS: { label: string; type: ItemType }[] = [
  { label: 'Location', type: 'location' },
  { label: 'Accommodation', type: 'accommodation' },
  { label: 'Activity', type: 'activity' },
  { label: 'Note', type: 'note' },
];

export default function DayDetailScreen() {
  const { id, dayId } = useLocalSearchParams<{ id: string; dayId: string }>();
  const { loadedTrips, loadTripById, reorderItems, moveItem, deleteItem } = useTripStore();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (id) loadTripById(id);
  }, [id]);

  function openItem(itemId: string) {
    router.push({ pathname: '/trip/[id]/item', params: { id, dayId, itemId } });
  }

  function addItem() {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Add item',
        options: [...ADD_OPTIONS.map((o) => o.label), 'Cancel'],
        cancelButtonIndex: ADD_OPTIONS.length,
      },
      (index) => {
        const choice = ADD_OPTIONS[index];
        if (choice) router.push({ pathname: '/trip/[id]/item', params: { id, dayId, type: choice.type } });
      },
    );
  }

  function moveToDay(item: Item) {
    if (!trip) return;
    const targets = [...trip.days]
      .filter((d) => d.id !== dayId)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (targets.length === 0) return;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Move to day',
        options: [...targets.map((d) => d.date), 'Cancel'],
        cancelButtonIndex: targets.length,
      },
      (index) => {
        const target = targets[index];
        if (target) moveItem(id, dayId, target.id, item.id);
      },
    );
  }

  function confirmDelete(item: Item) {
    Alert.alert('Delete item', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteItem(id, dayId, item.id) },
    ]);
  }

  function showItemActions(item: Item) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Edit', 'Move to day…', 'Delete', 'Cancel'],
        destructiveButtonIndex: 2,
        cancelButtonIndex: 3,
      },
      (index) => {
        if (index === 0) openItem(item.id);
        else if (index === 1) moveToDay(item);
        else if (index === 2) confirmDelete(item);
      },
    );
  }

  // Gesture pattern (per issue #9): the drag-pickup long-press and the
  // action-sheet long-press are disambiguated by distance. A long-press picks
  // the row up for dragging; releasing in place (from === to, i.e. no movement)
  // opens the action sheet, while releasing after a drag commits the reorder.
  // A plain tap is a shortcut straight to Edit.
  function onDragEnd({ data, from, to }: { data: Item[]; from: number; to: number }) {
    if (from === to) {
      const item = data[to];
      if (item) showItemActions(item);
    } else {
      reorderItems(id, dayId, from, to);
    }
  }

  function renderItem({ item, drag, isActive }: RenderItemParams<Item>) {
    return (
      <Pressable
        onPress={() => openItem(item.id)}
        onLongPress={drag}
        disabled={isActive}
        accessibilityLabel={`Edit ${item.type}`}
        style={isActive ? styles.activeRow : undefined}
      >
        <ItemRow item={item} />
      </Pressable>
    );
  }

  const bg = colorScheme === 'dark' ? '#000' : '#fff';
  const text = colorScheme === 'dark' ? '#fff' : '#111';
  const subtext = colorScheme === 'dark' ? '#aaa' : '#666';

  const trip = loadedTrips[id] ?? null;
  const day = trip?.days.find((d) => d.id === dayId) ?? null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: text }]}>{day ? day.date : 'Day'}</Text>
        {day ? (
          <Pressable onPress={addItem} accessibilityLabel="Add item" hitSlop={8}>
            <Text style={styles.add}>+</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {!trip ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : !day || day.items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: subtext }]}>No items yet</Text>
          {day ? (
            <Pressable onPress={addItem} accessibilityLabel="Add first item" style={styles.emptyAdd}>
              <Text style={styles.emptyAddText}>Add an item</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <DraggableFlatList
          data={day.items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onDragEnd={onDragEnd}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  back: { fontSize: 17, color: '#007AFF' },
  title: { fontSize: 17, fontWeight: '600' },
  headerSpacer: { width: 40 },
  add: { fontSize: 28, lineHeight: 30, color: '#007AFF', width: 40, textAlign: 'right' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 16 },
  emptyAdd: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20 },
  emptyAddText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingVertical: 8 },
  activeRow: { opacity: 0.6 },
});
