import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { GlassContainer, GlassView } from 'expo-glass-effect';

import type { Day, Trip } from '@/lib/schema';

function itemCountLabel(day: Day): string {
  const n = day.items.length;
  if (n === 0) return 'No items';
  return `${n} item${n === 1 ? '' : 's'}`;
}

export function DayList({
  trip,
  todayDate,
  onSelectDay,
}: {
  trip: Trip;
  todayDate?: string;
  onSelectDay?: (dayId: string) => void;
}) {
  const colorScheme = useColorScheme();
  const text = colorScheme === 'dark' ? '#fff' : '#111';
  const subtext = colorScheme === 'dark' ? '#aaa' : '#666';

  const days = [...trip.days].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <GlassContainer style={styles.container}>
      {days.map((day) => {
        const isToday = todayDate != null && day.date === todayDate;
        return (
          <GlassView key={day.id} glassEffectStyle="clear" style={styles.card}>
            <Pressable
              onPress={onSelectDay ? () => onSelectDay(day.id) : undefined}
              style={styles.cardInner}
              accessibilityLabel={`Day ${day.date}`}
            >
              <View style={styles.cardContent}>
                <View style={styles.dateRow}>
                  <Text style={[styles.cardDate, { color: text }]}>{day.date}</Text>
                  {isToday ? (
                    <View style={styles.todayBadge}>
                      <Text style={styles.todayBadgeText}>Today</Text>
                    </View>
                  ) : null}
                </View>
                {day.notes ? (
                  <Text style={[styles.cardNotes, { color: subtext }]} numberOfLines={1}>
                    {day.notes}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.cardCount, { color: subtext }]}>{itemCountLabel(day)}</Text>
            </Pressable>
          </GlassView>
        );
      })}
    </GlassContainer>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  card: { borderRadius: 16, overflow: 'hidden' },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardContent: { flex: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardDate: { fontSize: 16, fontWeight: '600' },
  cardNotes: { marginTop: 2, fontSize: 13 },
  cardCount: { fontSize: 13 },
  todayBadge: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  todayBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
