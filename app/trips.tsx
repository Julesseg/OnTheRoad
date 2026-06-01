import React, { useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  SectionList,
  StyleSheet,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import { Swipeable } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';

import { useTripStore } from '@/lib/store';
import { partitionTrips } from '@/lib/trip-partition';
import { canFavorite } from '@/lib/active-trip';
import { todayString } from '@/lib/date-utils';
import { wallpaperDisplayUri, exportTripAsFile } from '@/lib/storage';
import type { TripSummary } from '@/lib/schema';

type Section = { title: string; data: TripSummary[] };

export default function TripsSheet() {
  const { trips, activeTripId, setFavorite, clearFavorite, removeTrip, setDisplayedTrip } =
    useTripStore();
  const today = todayString();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { active } = partitionTrips(trips, today);
  const sections: Section[] = [
    { title: 'In progress', data: active.inProgress },
    { title: 'Upcoming', data: active.upcoming },
  ].filter((s) => s.data.length > 0);

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
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeTrip(summary.id),
      },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7' }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.toolbar}>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityLabel="Settings"
            accessibilityRole="button"
          >
            <GlassView glassEffectStyle="regular" isInteractive style={styles.toolbarBtn}>
              <SymbolView
                name="gearshape"
                tintColor="#007AFF"
                resizeMode="scaleAspectFit"
                style={styles.toolbarIcon}
              />
            </GlassView>
          </Pressable>

          <Text style={[styles.title, { color: isDark ? '#fff' : '#111' }]}>Trips</Text>

          <Pressable
            onPress={() => router.push('/trip/new')}
            accessibilityLabel="New trip"
            accessibilityRole="button"
          >
            <GlassView glassEffectStyle="regular" isInteractive style={styles.toolbarBtn}>
              <SymbolView
                name="plus"
                tintColor="#007AFF"
                resizeMode="scaleAspectFit"
                style={styles.toolbarIcon}
              />
            </GlassView>
          </Pressable>
        </View>

        {sections.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: isDark ? '#8e8e93' : '#6d6d72' }]}>
              No active trips
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section }) => (
              <Text style={[styles.sectionHeader, { color: isDark ? '#8e8e93' : '#6d6d72' }]}>
                {section.title}
              </Text>
            )}
            renderItem={({ item }) => (
              <TripRow
                summary={item}
                isFavorite={activeTripId === item.id}
                canFav={canFavorite(item, today)}
                onToggleFavorite={() => {
                  if (activeTripId === item.id) clearFavorite();
                  else setFavorite(item.id);
                }}
                onTap={() => {
                  // ADR-0001: reuse the single page — set the Displayed Trip in
                  // store state rather than pushing a /trip/[id] route. Dismiss
                  // the whole sheet stack (trips + days) back to the bare map;
                  // index.tsx re-presents the permanent days sheet on focus,
                  // which remounts it at its 50% initial detent.
                  setDisplayedTrip(item.id);
                  router.dismissAll();
                }}
                onExport={() => onExport(item)}
                onDelete={() => onDelete(item)}
              />
            )}
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

type TripRowProps = {
  summary: TripSummary;
  isFavorite: boolean;
  canFav: boolean;
  onToggleFavorite: () => void;
  onTap: () => void;
  onExport: () => void;
  onDelete: () => void;
};

function TripRow({ summary, isFavorite, canFav, onToggleFavorite, onTap, onExport, onDelete }: TripRowProps) {
  const swipeRef = useRef<Swipeable>(null);

  function renderRightActions() {
    return (
      <View style={styles.swipeActions}>
        <Pressable
          onPress={() => {
            swipeRef.current?.close();
            onExport();
          }}
          style={[styles.swipeAction, styles.swipeExport]}
          accessibilityLabel="Export"
        >
          <Text style={styles.swipeActionText}>Export</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            swipeRef.current?.close();
            onDelete();
          }}
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
        onLongPress={() =>
          Alert.alert(summary.title, '', [
            { text: 'Export', onPress: onExport },
            { text: 'Delete', style: 'destructive', onPress: onDelete },
            { text: 'Cancel', style: 'cancel' },
          ])
        }
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

          {canFav && (
            <Pressable
              onPress={onToggleFavorite}
              accessibilityLabel={isFavorite ? 'Remove favorite' : 'Make favorite'}
              accessibilityRole="button"
              style={styles.starBtn}
            >
              <Text style={styles.starText}>{isFavorite ? '★' : '☆'}</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '700' },
  toolbarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarIcon: { width: 20, height: 20 },

  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  list: { paddingBottom: 24 },

  row: {
    height: 100,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  rowFallback: { backgroundColor: '#3a3a3c' },
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  rowText: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  rowDates: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },

  starBtn: { padding: 8 },
  starText: { fontSize: 22, color: '#FFD60A' },

  swipeActions: { flexDirection: 'row', marginVertical: 4, marginRight: 16, borderRadius: 14, overflow: 'hidden' },
  swipeAction: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeExport: { backgroundColor: '#30d158' },
  swipeDelete: { backgroundColor: '#ff3b30' },
  swipeActionText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16 },
});
