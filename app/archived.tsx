import React, { useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  Alert,
  useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { Swipeable } from 'react-native-gesture-handler';
import { Stack, router } from 'expo-router';
import * as Sharing from 'expo-sharing';

import { useTripStore } from '@/lib/store';
import { ProgressiveBlurView } from '@/components/progressive-blur';
import { partitionTrips } from '@/lib/trip-partition';
import { todayString } from '@/lib/date-utils';
import { wallpaperDisplayUri, exportTripAsFile } from '@/lib/storage';
import type { TripSummary } from '@/lib/schema';

// Height of the progressive-blur band behind the transparent nav bar (mirrors
// the trips and days sheets).
const NAV_BAR_HEIGHT = 64;

export default function ArchivedSheet() {
  const trips = useTripStore((s) => s.trips);
  const setDisplayedTrip = useTripStore((s) => s.setDisplayedTrip);
  const removeTrip = useTripStore((s) => s.removeTrip);
  const today = todayString();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { archived } = partitionTrips(trips, today);

  async function onExport(summary: TripSummary) {
    try {
      const uri = await exportTripAsFile(summary.id);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/json',
          UTI: 'public.json',
          dialogTitle: `Export ${summary.title}`,
        });
      } else {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
      }
    } catch {
      Alert.alert('Export failed', 'Could not export this trip.');
    }
  }

  function onDelete(summary: TripSummary) {
    Alert.alert('Delete trip', `Delete "${summary.title}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeTrip(summary.id) },
    ]);
  }

  // Same chrome as the trips/days sheets: a transparent native nav bar with the
  // title, plus a progressive-blur RN overlay that frosts content scrolling under it.
  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7' }]}>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>Archived trips</Stack.Title>

      {archived.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: isDark ? '#8e8e93' : '#6d6d72' }]}>
            No archived trips
          </Text>
        </View>
      ) : (
        <FlatList
          data={archived}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ArchivedRow
              summary={item}
              onTap={() => {
                setDisplayedTrip(item.id);
                router.dismissAll();
              }}
              onExport={() => onExport(item)}
              onDelete={() => onDelete(item)}
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Progressive blur behind the transparent nav bar (mirrors days/trips). */}
      <View pointerEvents="none" style={[styles.navBlur, { height: NAV_BAR_HEIGHT }]}>
        <ProgressiveBlurView intensity={20} layers={10} />
      </View>
    </View>
  );
}

type ArchivedRowProps = {
  summary: TripSummary;
  onTap: () => void;
  onExport: () => void;
  onDelete: () => void;
};

function ArchivedRow({ summary, onTap, onExport, onDelete }: ArchivedRowProps) {
  const swipeRef = useRef<Swipeable>(null);

  function renderRightActions() {
    return (
      <View style={styles.swipeActions}>
        <Pressable
          onPress={() => { swipeRef.current?.close(); onExport(); }}
          style={[styles.swipeAction, styles.swipeExport]}
          accessibilityLabel="Export"
        >
          <Text style={styles.swipeActionText}>Export</Text>
        </Pressable>
        <Pressable
          onPress={() => { swipeRef.current?.close(); onDelete(); }}
          style={[styles.swipeAction, styles.swipeDelete]}
          accessibilityLabel="Delete"
        >
          <Text style={styles.swipeActionText}>Delete</Text>
        </Pressable>
      </View>
    );
  }

  const wallpaperUri = summary.wallpaperUri ? wallpaperDisplayUri(summary.wallpaperUri) : null;

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} friction={2} rightThreshold={40}>
      <Pressable
        onPress={onTap}
        accessibilityRole="button"
        accessibilityLabel={summary.title}
        style={styles.row}
      >
        {wallpaperUri ? (
          <Image source={{ uri: wallpaperUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.rowFallback]} />
        )}
        <View style={[StyleSheet.absoluteFill, styles.scrim]} />

        <View style={styles.rowContent}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>{summary.title}</Text>
            <Text style={styles.rowDates}>{summary.startDate} — {summary.endDate}</Text>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBlur: { position: 'absolute', top: 0, left: 0, right: 0 },
  list: { paddingBottom: 24 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16 },

  row: {
    height: 100,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  rowFallback: { backgroundColor: '#3a3a3c' },
  scrim: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 14 },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  rowText: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  rowDates: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },

  swipeActions: { flexDirection: 'row', marginVertical: 4, marginRight: 16, borderRadius: 14, overflow: 'hidden' },
  swipeAction: { width: 80, alignItems: 'center', justifyContent: 'center' },
  swipeExport: { backgroundColor: '#30d158' },
  swipeDelete: { backgroundColor: '#ff3b30' },
  swipeActionText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
