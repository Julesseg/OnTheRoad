import { useState } from 'react';
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native';

import { formatItem, linkify, itemTime, sortItemsByTime } from '@/lib/item-display';
import { useThemeColors } from '@/constants/theme';
import type { Day, Item } from '@/lib/schema';

function itemBody(item: Item): string | undefined {
  return item.notes;
}

function CompanionItem({ item, highlighted }: { item: Item; highlighted: boolean }) {
  const c = useThemeColors();
  const text = c.text;
  const subtext = c.textSubtle;
  const [expanded, setExpanded] = useState(false);

  const { title } = formatItem(item);
  const time = itemTime(item);
  const body = itemBody(item);

  return (
    <View style={[styles.card, highlighted && { backgroundColor: c.accent + '1f' }]}>
      {highlighted ? <Text style={[styles.nextUp, { color: c.accent }]}>Next up</Text> : null}
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: text }]}>{title}</Text>
        {time ? <Text style={[styles.time, { color: c.accent }]}>{time}</Text> : null}
      </View>
      {body ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Notes for ${title}`}
          aria-expanded={expanded}
          onPress={() => setExpanded((e) => !e)}
        >
          <Text style={[styles.body, { color: subtext }]} numberOfLines={expanded ? undefined : 2}>
            {linkify(body).map((seg, i) =>
              seg.kind === 'text' ? (
                <Text key={i}>{seg.value}</Text>
              ) : (
                <Text
                  key={i}
                  style={[styles.link, { color: c.accent }]}
                  onPress={() => Linking.openURL(seg.href).catch(() => {})}
                >
                  {seg.value}
                </Text>
              ),
            )}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function TodayCompanion({ day, highlightId }: { day: Day; highlightId: string | null }) {
  return (
    <View style={styles.container}>
      {sortItemsByTime(day.items).map((item) => (
        <CompanionItem key={item.id} item={item} highlighted={item.id === highlightId} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  card: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16 },
  nextUp: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 26, fontWeight: '700' },
  time: { fontSize: 22, fontWeight: '600' },
  body: { marginTop: 6, fontSize: 16, lineHeight: 22 },
  link: {},
});
