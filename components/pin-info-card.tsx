import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PinInfoCardModel } from '@/lib/pin-info-card';
import { useThemeColors } from '@/constants/theme';

/**
 * The lightweight floating card shown when a trip pin is tapped (CONTEXT.md#pin):
 * the item's name, category accent, time, and a notes snippet, with a path to the
 * full item and — when it has coordinates — to the preferred maps app. Purely
 * presentational; the owning screen positions it above the day sheet.
 */
export function PinInfoCard({
  card,
  onOpen,
  onNavigate,
}: {
  card: PinInfoCardModel;
  onOpen: () => void;
  onNavigate: () => void;
}) {
  const c = useThemeColors();
  return (
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.separator }]}
      accessibilityLabel="Pin info card"
    >
      <View style={styles.header}>
        <View style={[styles.accentDot, { backgroundColor: card.accent }]} />
        <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
          {card.name}
        </Text>
        {card.time ? <Text style={[styles.time, { color: c.textSubtle }]}>{card.time}</Text> : null}
      </View>
      {card.notesSnippet ? (
        <Text style={[styles.notes, { color: c.textSubtle }]} numberOfLines={2}>
          {card.notesSnippet}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable accessibilityLabel="Open item" onPress={onOpen} style={styles.action}>
          <Text style={[styles.actionText, { color: c.accent }]}>Details</Text>
        </Pressable>
        {card.hasLocation ? (
          <Pressable accessibilityLabel="Open in maps" onPress={onNavigate} style={styles.action}>
            <Text style={[styles.actionText, { color: c.accent }]}>Directions</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accentDot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  time: { fontSize: 14, fontWeight: '500' },
  notes: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 20, marginTop: 2 },
  action: { paddingVertical: 2 },
  actionText: { fontSize: 15, fontWeight: '600' },
});
