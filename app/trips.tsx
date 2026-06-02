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
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import { Swipeable } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';

import { useTripStore } from '@/lib/store';
import { partitionTrips } from '@/lib/trip-partition';
import { countdownPill } from '@/lib/trip-badge';
import { todayString, formatDateRange } from '@/lib/date-utils';
import { wallpaperDisplayUri, exportTripAsFile } from '@/lib/storage';
import type { TripSummary } from '@/lib/schema';

const FAVORITE_GOLD = '#FFD60A';
const NOW_GREEN = '#34C759'; // in-progress trip — "Now"
const UPCOMING_BLUE = '#007AFF'; // upcoming trip — "in N"

export default function TripsSheet() {
  const { trips, activeTripId, setFavorite, clearFavorite, removeTrip, setDisplayedTrip } =
    useTripStore();
  const today = todayString();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Flat, scannable list: in-progress trips first, then upcoming, each already
  // sorted by start date. Archived/past trips stay hidden.
  const { active } = partitionTrips(trips, today);
  const visibleTrips = [...active.inProgress, ...active.upcoming];

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

        {visibleTrips.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: isDark ? '#8e8e93' : '#6d6d72' }]}>
              No active trips
            </Text>
          </View>
        ) : (
          <FlatList
            data={visibleTrips}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TripRow
                summary={item}
                today={today}
                isDark={isDark}
                isFavorite={activeTripId === item.id}
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
                onEdit={() => router.push(`/trip/${item.id}/edit`)}
                onExport={() => onExport(item)}
                onDelete={() => onDelete(item)}
              />
            )}
            contentContainerStyle={styles.list}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

type TripRowProps = {
  summary: TripSummary;
  today: string;
  isDark: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onTap: () => void;
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
};

function TripRow({
  summary,
  today,
  isDark,
  isFavorite,
  onToggleFavorite,
  onTap,
  onEdit,
  onExport,
  onDelete,
}: TripRowProps) {
  const swipeRef = useRef<Swipeable>(null);

  // Left-swipe toggles the single persisted favorite; every visible row
  // qualifies (all end today or later).
  function renderLeftActions() {
    return (
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          onToggleFavorite();
        }}
        style={[styles.swipeAction, styles.swipeFavorite]}
        accessibilityRole="button"
        accessibilityLabel={isFavorite ? 'Unfavorite' : 'Favorite'}
      >
        <SymbolView
          name={isFavorite ? 'star.slash.fill' : 'star.fill'}
          tintColor="#fff"
          resizeMode="scaleAspectFit"
          style={styles.swipeIcon}
        />
      </Pressable>
    );
  }

  // Right-swipe exposes Edit + Delete; Export lives in the long-press menu.
  function renderRightActions() {
    return (
      <View style={styles.rightActions}>
        <Pressable
          onPress={() => {
            swipeRef.current?.close();
            onEdit();
          }}
          style={[styles.swipeAction, styles.swipeEdit]}
          accessibilityRole="button"
          accessibilityLabel="Edit"
        >
          <Text style={styles.swipeActionText}>Edit</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            swipeRef.current?.close();
            onDelete();
          }}
          style={[styles.swipeAction, styles.swipeDelete]}
          accessibilityRole="button"
          accessibilityLabel="Delete"
        >
          <Text style={styles.swipeActionText}>Delete</Text>
        </Pressable>
      </View>
    );
  }

  const wallpaperUri = summary.wallpaperUri ? wallpaperDisplayUri(summary.wallpaperUri) : null;
  const pill = countdownPill(summary, today);
  // Visible rows always end today or later, so an early start date means the
  // trip is live now — give that pill a distinct green vs. the blue countdown.
  const isNow = summary.startDate <= today;

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      friction={2}
      leftThreshold={40}
      rightThreshold={40}
    >
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
        aria-selected={isFavorite}
        style={[
          styles.row,
          { backgroundColor: isDark ? '#2c2c2e' : '#fff' },
          isFavorite && styles.rowFavorite,
        ]}
      >
        <View style={styles.thumb}>
          {wallpaperUri ? (
            <Image
              source={{ uri: wallpaperUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <View
              style={[styles.thumbFallback, { backgroundColor: isDark ? '#3a3a3c' : '#e5e5ea' }]}
            >
              <SymbolView
                name="map"
                tintColor="#8e8e93"
                resizeMode="scaleAspectFit"
                style={styles.thumbIcon}
              />
            </View>
          )}
        </View>

        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: isDark ? '#fff' : '#111' }]} numberOfLines={1}>
            {summary.title}
          </Text>
          <View style={styles.datesRow}>
            <Text style={[styles.rowDates, { color: isDark ? '#aeaeb2' : '#6d6d72' }]} numberOfLines={1}>
              {formatDateRange(summary.startDate, summary.endDate)}
            </Text>
            <View style={[styles.pill, { backgroundColor: isNow ? NOW_GREEN : UPCOMING_BLUE }]}>
              <Text style={styles.pillText}>{pill}</Text>
            </View>
          </View>
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

  list: { paddingVertical: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 92,
    marginHorizontal: 16,
    marginVertical: 5,
    padding: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowFavorite: { borderColor: FAVORITE_GOLD },

  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  thumbIcon: { width: 32, height: 32 },

  rowText: { flex: 1, justifyContent: 'center' },
  rowTitle: { fontSize: 17, fontWeight: '600' },
  datesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  rowDates: { fontSize: 13, flexShrink: 1 },
  pill: {
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  swipeAction: {
    width: 80,
    marginVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  swipeFavorite: { backgroundColor: FAVORITE_GOLD, marginLeft: 16 },
  rightActions: { flexDirection: 'row', marginRight: 16 },
  swipeEdit: { backgroundColor: '#007AFF' },
  swipeDelete: { backgroundColor: '#ff3b30' },
  swipeIcon: { width: 26, height: 26 },
  swipeActionText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16 },
});
