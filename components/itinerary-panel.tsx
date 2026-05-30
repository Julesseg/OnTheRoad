import { useMemo, useRef, type ReactElement } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, ActionSheetIOS, Alert, useColorScheme } from 'react-native';
import { router } from 'expo-router';

import type { Trip, Item } from '@/lib/schema';
import type { ItemType } from '@/lib/item-form';
import { useTripStore } from '@/lib/store';
import { buildItineraryRows, dayHeaderIndex, type ItineraryRow } from '@/lib/itinerary-rows';
import { formatDayLabel } from '@/lib/date-utils';
import { formatItem } from '@/lib/item-display';
import { ItemRow } from './item-row';

const TINT = '#007AFF';

// Item types offered when adding to a day, paired with their action-sheet labels.
const ADD_ITEM_OPTIONS: { type: ItemType; label: string }[] = [
  { type: 'location', label: 'Location' },
  { type: 'accommodation', label: 'Accommodation' },
  { type: 'activity', label: 'Activity' },
  { type: 'note', label: 'Note' },
];

function keyForRow(row: ItineraryRow): string {
  switch (row.kind) {
    case 'nextUp':
      return 'next-up';
    case 'dayHeader':
      return `h:${row.dayId}`;
    case 'item':
      return `i:${row.item.id}`;
  }
}

/**
 * The itinerary as one flattened list: an optional Next-up card, then each Day's
 * header followed by its Item rows in stored order. A single FlatList (rather
 * than per-day lists) so it scrolls within the sheet, supports scroll-to-Day for
 * the Next-up card, and can later host cross-day drag.
 */
export function ItineraryPanel({
  trip,
  now = new Date(),
  header,
}: {
  trip: Trip;
  now?: Date;
  header?: ReactElement | null;
}) {
  const colorScheme = useColorScheme();
  const text = colorScheme === 'dark' ? '#fff' : '#111';
  const subtext = colorScheme === 'dark' ? '#aaa' : '#666';

  const deleteItem = useTripStore((s) => s.deleteItem);
  const moveItem = useTripStore((s) => s.moveItem);

  const rows = useMemo(() => buildItineraryRows(trip, now), [trip, now]);
  const listRef = useRef<FlatList<ItineraryRow>>(null);

  function scrollToDay(dayId: string) {
    const index = dayHeaderIndex(rows, dayId);
    if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
  }

  function openItemEditor(dayId: string, itemId: string) {
    router.push({ pathname: '/trip/[id]/item', params: { id: trip.id, dayId, itemId } });
  }

  function confirmDelete(dayId: string, item: Item) {
    const label = item.type === 'note' ? 'this note' : item.name;
    Alert.alert('Delete item', `Delete "${label}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteItem(trip.id, dayId, item.id) },
    ]);
  }

  function showMoveToDaySheet(fromDayId: string, itemId: string) {
    const sorted = [...trip.days].sort((a, b) => a.date.localeCompare(b.date));
    const others = sorted.filter((d) => d.id !== fromDayId);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Move to day',
        options: [...others.map((d) => `Day ${sorted.indexOf(d) + 1}`), 'Cancel'],
        cancelButtonIndex: others.length,
      },
      (index) => {
        const target = others[index];
        if (target) moveItem(trip.id, fromDayId, target.id, itemId);
      },
    );
  }

  function showItemActions(dayId: string, item: Item) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Edit', 'Move to day', 'Delete', 'Cancel'],
        cancelButtonIndex: 3,
        destructiveButtonIndex: 2,
      },
      (index) => {
        if (index === 0) openItemEditor(dayId, item.id);
        else if (index === 1) showMoveToDaySheet(dayId, item.id);
        else if (index === 2) confirmDelete(dayId, item);
      },
    );
  }

  // Pick an item type for the day, then open the editor to create it.
  function addItemToDay(dayId: string) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Add item',
        options: [...ADD_ITEM_OPTIONS.map((o) => o.label), 'Cancel'],
        cancelButtonIndex: ADD_ITEM_OPTIONS.length,
      },
      (index) => {
        const choice = ADD_ITEM_OPTIONS[index];
        if (choice) {
          router.push({
            pathname: '/trip/[id]/item',
            params: { id: trip.id, dayId, type: choice.type },
          });
        }
      },
    );
  }

  function renderRow(row: ItineraryRow) {
    switch (row.kind) {
      case 'nextUp': {
        const item = trip.days
          .find((d) => d.id === row.dayId)
          ?.items.find((i) => i.id === row.itemId);
        if (!item) return null;
        const { typeLabel, title, lines } = formatItem(item);
        return (
          <Pressable
            onPress={() => scrollToDay(row.dayId)}
            accessibilityRole="button"
            accessibilityLabel="Next up"
            style={styles.nextUpCard}
          >
            <Text style={styles.nextUpLabel}>Next up</Text>
            <Text style={styles.nextUpType}>{typeLabel}</Text>
            <Text style={styles.nextUpTitle}>{title}</Text>
            {lines[0] ? <Text style={styles.nextUpDetail}>{lines[0]}</Text> : null}
          </Pressable>
        );
      }
      case 'dayHeader':
        return (
          <View style={styles.dayHeader}>
            <View style={styles.dayHeaderRow}>
              <View style={styles.dayHeaderTitle}>
                <Text style={[styles.dayNumber, { color: row.isToday ? TINT : text }]}>
                  Day {row.dayNumber}
                </Text>
                <Text style={[styles.dayDate, { color: subtext }]}>{formatDayLabel(row.date)}</Text>
              </View>
              <Pressable
                onPress={() => addItemToDay(row.dayId)}
                accessibilityRole="button"
                accessibilityLabel={`Add item to day ${row.dayNumber}`}
                hitSlop={10}
                style={styles.addButton}
              >
                <Text style={[styles.addButtonText, { color: TINT }]}>+</Text>
              </Pressable>
            </View>
            {row.notes ? (
              <Text style={[styles.dayNotes, { color: subtext }]}>{row.notes}</Text>
            ) : null}
          </View>
        );
      case 'item':
        return (
          <Pressable
            onPress={() => openItemEditor(row.dayId, row.item.id)}
            onLongPress={() => showItemActions(row.dayId, row.item)}
            accessibilityRole="button"
            accessibilityLabel={row.item.type === 'note' ? 'Edit note' : `Edit ${row.item.name}`}
          >
            <ItemRow item={row.item} />
          </Pressable>
        );
    }
  }

  return (
    <FlatList
      ref={listRef}
      style={styles.list}
      data={rows}
      keyExtractor={keyForRow}
      ListHeaderComponent={header}
      renderItem={({ item }) => renderRow(item)}
      onScrollToIndexFailed={(info) => {
        // Rows have variable, unmeasured heights; retry once layout settles.
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0 });
        }, 50);
      }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32 },

  nextUpCard: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  nextUpLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextUpType: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  nextUpTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 2 },
  nextUpDetail: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 4 },

  dayHeader: { marginTop: 20, marginBottom: 4 },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayHeaderTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  dayNumber: { fontSize: 20, fontWeight: '700' },
  dayDate: { fontSize: 14 },
  dayNotes: { marginTop: 4, fontSize: 14 },
  addButton: { paddingHorizontal: 4 },
  addButtonText: { fontSize: 28, fontWeight: '400', lineHeight: 30 },
});
