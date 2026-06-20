import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import type { Item } from '@/lib/schema';
import type { MapsTarget } from '@/lib/maps';
import { formatItem } from '@/lib/item-display';
import { itemIdentity } from '@/lib/item-identity';
import { checklistProgress } from '@/lib/checklist';
import { useThemeColors } from '@/constants/theme';

const WHITE = '#ffffff';

// The map destination an item exposes, if any — mirrors the itinerary panel so a
// pin's card and its row agree on whether "Directions" is offered.
export function mapsTargetForItem(item: Item): MapsTarget | null {
  if (!item.location) return null;
  const { lat, lng, address } = item.location;
  const coords = lat != null && lng != null ? { lat, lng } : undefined;
  if (!coords && !address) return null;
  return { coords, address };
}

/**
 * Android (Material 3) twin of pin-info-card.tsx. Same information and behaviour
 * as the iOS card and the itinerary row — category symbol + label, checklist
 * progress, name, address/time/notes lines, ticking checklist, and a Directions
 * button — but the Liquid-Glass surfaces become Material surfaces with elevation
 * (ADR-0015). Base file untouched; Metro picks this on Android.
 */
export function PinInfoCard({
  item,
  onOpen,
  onNavigate,
  onToggleChecklistEntry,
}: {
  item: Item;
  onOpen: () => void;
  onNavigate: () => void;
  onToggleChecklistEntry?: (entryId: string) => void;
}) {
  const c = useThemeColors();
  const { typeLabel, title, lines } = formatItem(item);
  const identity = itemIdentity(item.category);
  const checklist = item.checklist ?? [];
  const hasMapsTarget = mapsTargetForItem(item) != null;

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]} accessibilityLabel="Pin info card">
      <Pressable onPress={onOpen} accessibilityLabel="Open item" style={styles.body}>
        <View style={styles.typeRow}>
          <IconSymbol
            name={identity.symbol as IconSymbolName}
            color={identity.accent}
            size={13}
            style={styles.typeIcon}
          />
          <Text style={[styles.typeLabel, { color: c.textSubtle }]}>{typeLabel.toUpperCase()}</Text>
          {checklist.length > 0 ? (
            <>
              <IconSymbol
                name="checklist"
                color={c.textSubtle}
                size={10}
                style={styles.checklistProgressIcon}
              />
              <Text style={[styles.progress, { color: c.textSubtle }]}>
                {checklistProgress(checklist)}
              </Text>
            </>
          ) : null}
          <View style={styles.spacer} />
          {hasMapsTarget ? (
            <ActionPill
              label="Directions"
              accessibilityLabel="Open in maps"
              symbol="map"
              tint={c.secondaryAction}
              onPress={onNavigate}
            />
          ) : null}
        </View>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
          {title}
        </Text>
        {lines.map((line, i) => (
          <Text key={i} style={[styles.line, { color: c.textSubtle }]} numberOfLines={2}>
            {line}
          </Text>
        ))}
      </Pressable>

      {checklist.length > 0 ? (
        <View style={styles.checklist}>
          {checklist.map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityLabel={entry.label}
              onPress={() => onToggleChecklistEntry?.(entry.id)}
              style={styles.checkRow}
            >
              <IconSymbol
                name={entry.checked ? 'checkmark.circle.fill' : 'circle'}
                color={entry.checked ? c.accent : c.textSubtle}
                size={18}
                style={styles.checkIcon}
              />
              <Text style={[styles.checkLabel, { color: c.text }]}>{entry.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// A filled Material capsule (tonal button), replacing the iOS tinted-glass pill.
function ActionPill({
  label,
  accessibilityLabel,
  symbol,
  tint,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  symbol: IconSymbolName;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, { backgroundColor: tint, opacity: pressed ? 0.85 : 1 }]}
    >
      <IconSymbol name={symbol} color={WHITE} size={14} style={styles.pillIcon} />
      <Text style={styles.pillLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: 14,
    gap: 8,
    // Material elevation in place of Liquid Glass.
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  body: { gap: 3 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  spacer: { flex: 1 },
  typeIcon: { width: 13, height: 13 },
  checklistProgressIcon: { width: 10, height: 10 },
  typeLabel: { fontSize: 11, fontWeight: '600' },
  progress: { fontSize: 11, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '600', marginTop: 1 },
  line: { fontSize: 14 },
  checklist: { gap: 6, marginTop: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkIcon: { width: 18, height: 18 },
  checkLabel: { fontSize: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  pillIcon: { width: 14, height: 14 },
  pillLabel: { fontSize: 14, fontWeight: '600', color: WHITE },
});
