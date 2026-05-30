import { View, Text, Linking, Pressable, ActionSheetIOS, StyleSheet, useColorScheme } from 'react-native';

import { formatItem, linkify } from '@/lib/item-display';
import { openInMaps, MAPS_APP_LABELS, type MapsTarget } from '@/lib/maps';
import { useTripStore } from '@/lib/store';
import type { Item } from '@/lib/schema';

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

export function ItemRow({ item }: { item: Item }) {
  const { typeLabel, title, lines } = formatItem(item);
  const mapsTarget = mapsTargetForItem(item);
  const preferredMapsApp = useTripStore((s) => s.preferredMapsApp);
  const installedMapsApps = useTripStore((s) => s.installedMapsApps);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const titleColor = isDark ? '#fff' : '#111';
  const lineColor = isDark ? '#b0b0b0' : '#444';
  const typeLabelColor = isDark ? '#9a9a9a' : '#888';
  const borderColor = isDark ? '#3a3a3c' : '#e0e0e0';

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

  return (
    <View style={[styles.row, { borderBottomColor: borderColor }]}>
      <Text style={[styles.typeLabel, { color: typeLabelColor }]}>{typeLabel}</Text>
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      {lines.map((line, i) => (
        <Text key={i} style={[styles.line, { color: lineColor }]}>
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
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  typeLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  title: { marginTop: 2, fontSize: 16, fontWeight: '600' },
  line: { marginTop: 4, fontSize: 14 },
  link: { color: '#007AFF' },
  mapsButton: { marginTop: 8, alignSelf: 'flex-start' },
  mapsButtonText: { fontSize: 14, fontWeight: '600', color: '#0a7ea4' },
});
