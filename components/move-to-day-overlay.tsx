import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { Host, DatePicker } from '@expo/ui/swift-ui';
import { datePickerStyle, frame } from '@expo/ui/swift-ui/modifiers';

import type { Trip } from '@/lib/schema';
import { dayIdForDate } from '@/lib/trip-days';

/** Parse a YYYY-MM-DD string to a local Date at the given hour (default midnight). */
function localDate(date: string, hour = 0, min = 0, sec = 0, ms = 0): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hour, min, sec, ms);
}

/**
 * A floating glass calendar for moving an Item to another Day, centered over the
 * whole screen via a window-level `Modal` — so it stays centered regardless of
 * how far the itinerary sheet behind it is extended, and isn't reflowed by the
 * sheet's detent animation. The graphical DatePicker shows the full month and
 * disables dates outside the trip's span (`range`).
 *
 * Backdrop and card are siblings (the card is not itself pressable) so taps on
 * the calendar reach the native picker while taps outside dismiss.
 */
export function MoveToDayOverlay({
  trip,
  fromDayId,
  itemId,
  onMove,
  onClose,
}: {
  trip: Trip;
  fromDayId: string;
  itemId: string;
  onMove: (targetDayId: string) => void;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const fromDay = trip.days.find((d) => d.id === fromDayId);
  if (!fromDay) return null;

  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const fg = colorScheme === 'dark' ? '#fff' : '#111';

  function onDateChange(date: Date) {
    const targetDayId = dayIdForDate(trip, date);
    if (targetDayId && targetDayId !== fromDayId) onMove(targetDayId);
    onClose();
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
        {/* box-none so taps outside the card fall through to the backdrop below. */}
        <View style={styles.center} pointerEvents="box-none">
          <GlassView glassEffectStyle="regular" colorScheme={scheme} style={styles.card}>
            <Text style={[styles.title, { color: fg }]}>Move to another day</Text>
            {/* Fix the width only so the graphical picker lays out the whole month
                and its touch area matches what's drawn; height is left natural. */}
            <Host matchContents colorScheme={scheme}>
              <DatePicker
                // local noon avoids DST edges
                selection={localDate(fromDay.date, 12)}
                // Bound selection to the trip span: start of the first day through
                // the end of the last, so both endpoints stay selectable.
                range={{ start: localDate(trip.startDate), end: localDate(trip.endDate, 23, 59, 59, 999) }}
                displayedComponents={['date']}
                onDateChange={onDateChange}
                modifiers={[datePickerStyle('graphical'), frame({ width: 320 })]}
              />
            </Host>
          </GlassView>
        </View>
      </View>
    </Modal>
  );
}

const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...fill, backgroundColor: 'rgba(0,0,0,0.4)' },
  center: { ...fill, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 16,
    width: 352,
    alignItems: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
});
