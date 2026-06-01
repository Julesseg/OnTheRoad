import React, { useEffect } from 'react';
import { Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Host, DatePicker } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';

import { useTripStore } from '@/lib/store';
import { dayIdForDate } from '@/lib/trip-days';

/** Parse a YYYY-MM-DD string to a local Date at the given hour (default midnight). */
function localDate(date: string, hour = 0, min = 0, sec = 0, ms = 0): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hour, min, sec, ms);
}

/**
 * A centered "pop up" calendar for moving an Item to another Day. The graphical
 * DatePicker enables only the trip's dates (`range` disables everything outside
 * the span); picking a date resolves to that Day and moves the Item there.
 */
export default function MoveItemScreen() {
  const { id, fromDayId, itemId } = useLocalSearchParams<{
    id: string;
    fromDayId: string;
    itemId: string;
  }>();
  const colorScheme = useColorScheme();
  const { loadedTrips, loadTripById, moveItem } = useTripStore();

  useEffect(() => {
    if (id) loadTripById(id);
  }, [id]);

  const trip = loadedTrips[id] ?? null;
  const fromDay = trip?.days.find((d) => d.id === fromDayId) ?? null;

  if (!trip || !fromDay) {
    // Nothing to move against — dismiss rather than show an empty popup.
    return <Pressable style={styles.backdrop} onPress={() => router.back()} />;
  }

  // Bound the selectable range to the whole trip span: from the start of the
  // first day through the end of the last, so both endpoints stay selectable.
  const rangeStart = localDate(trip.startDate);
  const rangeEnd = localDate(trip.endDate, 23, 59, 59, 999);
  const selection = localDate(fromDay.date, 12); // local noon avoids DST edges

  function onDateChange(date: Date) {
    const targetDayId = dayIdForDate(trip!, date);
    if (targetDayId && targetDayId !== fromDayId) {
      moveItem(id, fromDayId, targetDayId, itemId);
    }
    router.back();
  }

  const card = colorScheme === 'dark' ? '#1c1c1e' : '#fff';

  return (
    <Pressable style={styles.backdrop} onPress={() => router.back()}>
      {/* Swallow taps on the card so only backdrop taps dismiss. */}
      <Pressable style={[styles.card, { backgroundColor: card }]} onPress={() => {}}>
        <Text style={[styles.title, { color: colorScheme === 'dark' ? '#fff' : '#111' }]}>
          Move to day
        </Text>
        <Host matchContents colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}>
          <DatePicker
            selection={selection}
            range={{ start: rangeStart, end: rangeEnd }}
            displayedComponents={['date']}
            onDateChange={onDateChange}
            modifiers={[datePickerStyle('graphical')]}
          />
        </Host>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
});
