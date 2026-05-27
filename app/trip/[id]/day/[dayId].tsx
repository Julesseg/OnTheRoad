import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ItemRow } from '@/components/item-row';
import { sortItemsByTime } from '@/lib/item-display';
import type { ItemType } from '@/lib/item-form';

const ADD_OPTIONS: { label: string; type: ItemType }[] = [
  { label: 'Location', type: 'location' },
  { label: 'Accommodation', type: 'accommodation' },
  { label: 'Activity', type: 'activity' },
  { label: 'Note', type: 'note' },
];

export default function DayDetailScreen() {
  const { id, dayId } = useLocalSearchParams<{ id: string; dayId: string }>();
  const { loadedTrips, loadTripById } = useTripStore();
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
        <ScrollView contentContainerStyle={styles.list}>
          {sortItemsByTime(day.items).map((item) => (
            <Pressable key={item.id} onPress={() => openItem(item.id)} accessibilityLabel={`Edit ${item.type}`}>
              <ItemRow item={item} />
            </Pressable>
          ))}
        </ScrollView>
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
});
