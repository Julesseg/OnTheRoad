import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/constants/theme';

import type { Day, Trip } from '@/lib/schema';

function itemCountLabel(day: Day): string {
  const n = day.items.length;
  if (n === 0) return 'No items';
  return `${n} item${n === 1 ? '' : 's'}`;
}

function dayHeadline(day: Day): string | undefined {
  if (day.notes) return day.notes;
  const first = day.items.find((i) => i.type !== 'note');
  if (first) return (first as any).name;
  const note = day.items.find((i) => i.type === 'note');
  if (note && note.type === 'note') return note.text.slice(0, 60);
  return undefined;
}

export function DayList({
  trip,
  todayDate,
  onSelectDay,
}: {
  trip: Trip;
  todayDate?: string;
  onSelectDay: (dayId: string) => void;
}) {
  const colorScheme = useColorScheme();
  const theme = useTheme(colorScheme);

  const days = [...trip.days].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <View style={styles.container}>
      {days.map((day, index) => {
        const isToday = todayDate != null && day.date === todayDate;
        const [y, m, d] = day.date.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const monthShort = dateObj.toLocaleDateString('en-US', { month: 'short' });
        const dayNum = dateObj.getDate();
        const weekdayShort = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const headline = dayHeadline(day);
        const countLabel = itemCountLabel(day);

        const dateBlockBg = isToday
          ? theme.accent
          : theme.dark
          ? 'rgba(255,255,255,0.06)'
          : '#F5F2EC';
        const dateTextColor = isToday ? '#FFFFFF' : theme.text;

        return (
          <Pressable
            key={day.id}
            onPress={() => onSelectDay(day.id)}
            accessibilityLabel={day.date}
            style={[styles.card, { backgroundColor: theme.card }]}
          >
            {/* Date block */}
            <View style={[styles.dateBlock, { backgroundColor: dateBlockBg }]}>
              <Text style={[styles.monthText, { color: dateTextColor }]}>{monthShort}</Text>
              <Text style={[styles.dayNumText, { color: dateTextColor }]}>{dayNum}</Text>
              {isToday ? (
                <Text style={styles.todayDot}>·</Text>
              ) : null}
            </View>

            {/* Right column */}
            <View style={styles.rightCol}>
              <Text style={[styles.dayLabel, { color: theme.text2 }]}>
                {'Day ' + (index + 1) + ' · ' + weekdayShort}
              </Text>
              {headline ? (
                <Text style={[styles.headline, { color: theme.text }]} numberOfLines={1}>
                  {headline}
                </Text>
              ) : null}
              <Text style={[styles.countLabel, { color: theme.text2 }]}>{countLabel}</Text>
              {isToday ? (
                <View style={[styles.todayBadge, { backgroundColor: theme.accent }]}>
                  <Text style={styles.todayBadgeText}>Today</Text>
                </View>
              ) : null}
            </View>

            {/* Chevron */}
            <IconSymbol name="chevron.right" size={14} color={theme.text3} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, paddingHorizontal: 16 },
  card: {
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  dateBlock: {
    width: 52,
    height: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    opacity: 0.7,
    textAlign: 'center',
  },
  dayNumText: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 28,
  },
  todayDot: {
    fontSize: 8,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  rightCol: { flex: 1 },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  headline: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  countLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  todayBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  todayBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
