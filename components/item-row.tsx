import { View, Text, Linking, Pressable, ActionSheetIOS, StyleSheet, useColorScheme } from 'react-native';

import { linkify } from '@/lib/item-display';
import { openInMaps, MAPS_APP_LABELS, type MapsTarget } from '@/lib/maps';
import { useTripStore } from '@/lib/store';
import { useTheme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Item } from '@/lib/schema';

const ITEM_META = {
  location:      { label: 'Location',      sfIcon: 'mappin' as const,          tint: '#E86A2C' },
  accommodation: { label: 'Stay',           sfIcon: 'bed.double' as const,      tint: '#7B5BCC' },
  activity:      { label: 'Activity',       sfIcon: 'figure.hiking' as const,   tint: '#3E8E58' },
  note:          { label: 'Note',           sfIcon: 'note.text' as const,       tint: '#8A8A93' },
};

function mapsTargetForItem(item: Item): MapsTarget | null {
  let coords: MapsTarget['coords'];
  let address: string | undefined;
  if (item.type === 'location') {
    if (item.lat != null && item.lng != null) coords = { lat: item.lat, lng: item.lng };
    address = item.address;
  } else if (item.type === 'accommodation') {
    address = item.address;
  }
  if (!coords && !address) return null;
  return { coords, address };
}

function getItemTitle(item: Item): string {
  if (item.type === 'note') return item.text;
  return item.name;
}

function getItemTime(item: Item): string | undefined {
  if (item.type === 'location') return item.time;
  if (item.type === 'accommodation') return item.checkIn;
  if (item.type === 'activity') return item.time;
  return undefined;
}

function getItemDetailLines(item: Item): string[] {
  const lines: string[] = [];
  if (item.type === 'location') {
    if (item.address) lines.push(item.address);
    if (item.notes) lines.push(item.notes);
  } else if (item.type === 'accommodation') {
    if (item.address) lines.push(item.address);
    if (item.checkIn && item.checkOut) lines.push(`Check-in ${item.checkIn} · Check-out ${item.checkOut}`);
    // confirmationNumber shown separately as badge
  } else if (item.type === 'activity') {
    if (item.duration != null) lines.push(`${item.duration} min`);
    if (item.notes) lines.push(item.notes);
  }
  // note: nothing extra, text is the title
  return lines;
}

export function ItemRow({ item, isLast }: { item: Item; isLast?: boolean }) {
  const colorScheme = useColorScheme();
  const theme = useTheme(colorScheme);
  const mapsTarget = mapsTargetForItem(item);
  const preferredMapsApp = useTripStore((s) => s.preferredMapsApp);
  const installedMapsApps = useTripStore((s) => s.installedMapsApps);

  const meta = ITEM_META[item.type];
  const title = getItemTitle(item);
  const time = getItemTime(item);
  const detailLines = getItemDetailLines(item);
  const confirmationNumber = item.type === 'accommodation' ? item.confirmationNumber : undefined;

  function chooseMapsApp(target: MapsTarget) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Open in Maps',
        options: [...installedMapsApps.map((app) => MAPS_APP_LABELS[app]), 'Cancel'],
        cancelButtonIndex: installedMapsApps.length,
      },
      (index) => {
        const app = installedMapsApps[index];
        if (app) openInMaps(target, { app }).catch(() => {});
      },
    );
  }

  // Icon chip background: tint + '22' (hex alpha ~13%)
  const chipBg = meta.tint + '22';

  return (
    <View style={styles.row}>
      {/* Icon chip */}
      <View style={[styles.iconChip, { backgroundColor: chipBg }]}>
        <IconSymbol name={meta.sfIcon} size={16} color={meta.tint} />
      </View>

      {/* Right column */}
      <View style={styles.rightCol}>
        {/* Header row: type label + optional time */}
        <View style={styles.headerRow}>
          <Text style={[styles.typeLabel, { color: meta.tint }]}>{meta.label}</Text>
          {time ? (
            <Text style={[styles.timeText, { color: theme.text2 }]}>{'  ·  '}{time}</Text>
          ) : null}
        </View>

        {/* Title (for note, this is the text; for others, the name) */}
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

        {/* Detail lines */}
        {detailLines.map((line, i) => (
          <Text key={i} style={[styles.detailLine, { color: theme.text2 }]}>
            {linkify(line).map((seg, j) =>
              seg.kind === 'text' ? (
                <Text key={j}>{seg.value}</Text>
              ) : (
                <Text key={j} style={styles.link} onPress={() => Linking.openURL(seg.href).catch(() => {})}>
                  {seg.value}
                </Text>
              ),
            )}
          </Text>
        ))}

        {/* Confirmation number badge */}
        {confirmationNumber ? (
          <View style={[styles.confirmBadge, { backgroundColor: theme.text3 + '22' }]}>
            <Text style={[styles.confirmText, { color: theme.text2 }]}>{confirmationNumber}</Text>
          </View>
        ) : null}

        {/* Maps button */}
        {mapsTarget ? (
          <Pressable
            onPress={() => openInMaps(mapsTarget, { app: preferredMapsApp }).catch(() => {})}
            onLongPress={() => chooseMapsApp(mapsTarget)}
            accessibilityRole="button"
            accessibilityLabel={`Open in ${MAPS_APP_LABELS[preferredMapsApp]}`}
            hitSlop={6}
            style={styles.mapsButton}
          >
            <Text style={styles.mapsButtonText}>Open in {MAPS_APP_LABELS[preferredMapsApp]}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Separator (not on last item) */}
      {!isLast ? (
        <View style={[styles.separator, { backgroundColor: theme.sep }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 16,
    position: 'relative',
  },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightCol: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timeText: {
    fontSize: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  detailLine: {
    fontSize: 14,
    marginTop: 3,
  },
  link: { color: '#007AFF' },
  confirmBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  confirmText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  mapsButton: { marginTop: 8, alignSelf: 'flex-start' },
  mapsButtonText: { fontSize: 14, fontWeight: '600', color: '#0a7ea4' },
  separator: {
    position: 'absolute',
    bottom: 0,
    left: 60,
    right: 0,
    height: 0.5,
  },
});
