import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

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
 * The floating info card shown when a trip pin is tapped (CONTEXT.md#pin). It is
 * liquid glass to match the rest of the app and shows the **same information as
 * the item's row in the itinerary panel** — category symbol + label, checklist
 * progress, name, the address/time/notes lines, and the ticking checklist — with
 * colored-pill actions through to the full item and the preferred maps app.
 * Purely presentational; the owning screen positions it above the day sheet.
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
    <GlassView
      glassEffectStyle="regular"
      style={styles.card}
      accessibilityLabel="Pin info card"
    >
      <Pressable onPress={onOpen} accessibilityLabel="Open item" style={styles.body}>
        <View style={styles.typeRow}>
          <SymbolView
            name={identity.symbol as SymbolViewProps['name']}
            tintColor={identity.accent}
            resizeMode="scaleAspectFit"
            style={styles.typeIcon}
          />
          <Text style={[styles.typeLabel, { color: c.textSubtle }]}>{typeLabel.toUpperCase()}</Text>
          {checklist.length > 0 ? (
            <Text style={[styles.progress, { color: c.textSubtle }]}>
              {checklistProgress(checklist)}
            </Text>
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
              <SymbolView
                name={(entry.checked ? 'checkmark.circle.fill' : 'circle') as SymbolViewProps['name']}
                tintColor={entry.checked ? c.accent : c.textSubtle}
                resizeMode="scaleAspectFit"
                style={styles.checkIcon}
              />
              <Text style={[styles.checkLabel, { color: c.text }]}>{entry.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <ActionPill
          label="Details"
          accessibilityLabel="Open item"
          symbol="pencil"
          tint={c.accent}
          onPress={onOpen}
        />
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
    </GlassView>
  );
}

// A colored liquid-glass capsule, matching the app's tinted-glass pills.
function ActionPill({
  label,
  accessibilityLabel,
  symbol,
  tint,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  symbol: SymbolViewProps['name'];
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress}>
      <GlassView glassEffectStyle="regular" tintColor={tint} style={styles.pill}>
        <SymbolView name={symbol} tintColor={WHITE} resizeMode="scaleAspectFit" style={styles.pillIcon} />
        <Text style={styles.pillLabel}>{label}</Text>
      </GlassView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The glass rounds its own corners; no overflow:'hidden' so the edge highlight
  // isn't clipped (see app/index.tsx).
  card: { borderRadius: 20, padding: 14, gap: 8 },
  body: { gap: 3 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  typeIcon: { width: 13, height: 13 },
  typeLabel: { fontSize: 11, fontWeight: '600' },
  progress: { fontSize: 11, fontWeight: '600', marginLeft: 4 },
  title: { fontSize: 16, fontWeight: '600', marginTop: 1 },
  line: { fontSize: 14 },
  checklist: { gap: 6, marginTop: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkIcon: { width: 18, height: 18 },
  checkLabel: { fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
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
