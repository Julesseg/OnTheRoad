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
import { formatDayLabel } from '@/lib/date-utils';
import type { Day, Item } from '@/lib/schema';
import type { ItemType } from '@/lib/item-form';
import { useTheme } from '@/constants/theme';

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
  const theme = useTheme(colorScheme);

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

  function moveToDay(item: Item, targets: Day[]) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Move to day',
        options: [...targets.map((d) => formatDayLabel(d.date)), 'Cancel'],
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
    const targets = trip
      ? [...trip.days].filter((d) => d.id !== dayId).sort((a, b) => a.date.localeCompare(b.date))
      : [];
    const options =
      targets.length > 0
        ? ['Edit', 'Move to day…', 'Delete', 'Cancel']
        : ['Edit', 'Delete', 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        destructiveButtonIndex: options.length - 2,
        cancelButtonIndex: options.length - 1,
      },
      (index) => {
        const choice = options[index];
        if (choice === 'Edit') openItem(item.id);
        else if (choice === 'Move to day…') moveToDay(item, targets);
        else if (choice === 'Delete') confirmDelete(item);
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
        accessibilityLabel={item.type}
        accessibilityHint="Double tap to edit, long press to reorder or open actions"
        style={isActive ? styles.activeRow : undefined}
      >
        <ItemRow item={item} />
      </Pressable>
    );
  }

  const trip = loadedTrips[id] ?? null;
  const day = trip?.days.find((d) => d.id === dayId) ?? null;

  const dayIndex = trip
    ? [...trip.days].sort((a, b) => a.date.localeCompare(b.date)).findIndex((d) => d.id === dayId)
    : -1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Nav bar */}
      <View style={[styles.navBar, { borderBottomColor: theme.sep }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back">
          <Text style={[styles.backText, { color: theme.accent }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: theme.text }]}>{day ? day.date : 'Day'}</Text>
        {day ? (
          <Pressable onPress={addItem} accessibilityLabel="Add item" hitSlop={8}>
            <Text style={[styles.addText, { color: theme.accent }]}>+</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* Day header section */}
      {day ? (
        <View style={[styles.dayHeader, { borderBottomColor: theme.sep }]}>
          <Text style={[styles.daySupertitle, { color: theme.accent }]}>
            {'Day ' + (dayIndex + 1) + (trip ? ' · ' + trip.title : '')}
          </Text>
          <Text style={[styles.dayDateText, { color: theme.text }]}>
            {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          {day.notes ? (
            <View style={[styles.notesBox, { backgroundColor: theme.accentSoft }]}>
              <Text style={[styles.notesText, { color: theme.text }]}>{day.notes}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {!trip ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : !day || day.items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.text2 }]}>No items yet</Text>
          {day ? (
            <Pressable onPress={addItem} accessibilityLabel="Add first item" style={styles.emptyAdd}>
              <Text style={[styles.emptyAddText, { color: theme.accent }]}>Add an item</Text>
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
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backText: { fontSize: 17, fontWeight: '500' },
  navTitle: { fontSize: 17, fontWeight: '600' },
  headerSpacer: { width: 40 },
  addText: { fontSize: 28, lineHeight: 30, width: 40, textAlign: 'right' },
  dayHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  daySupertitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dayDateText: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  notesBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 16 },
  emptyAdd: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20 },
  emptyAddText: { fontSize: 16, fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingVertical: 8 },
  activeRow: { opacity: 0.6 },
});
