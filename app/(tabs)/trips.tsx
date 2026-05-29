import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { GlassView } from 'expo-glass-effect';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';

import { useTripStore } from '@/lib/store';
import { TripSummary } from '@/lib/schema';
import { tripStatus } from '@/lib/date-utils';
import { wallpaperDisplayUri } from '@/lib/storage';
import { useTheme, Palette } from '@/constants/theme';

const STATUS_COLOR: Record<ReturnType<typeof tripStatus>, string> = {
  'In progress': '#5BC27E',
  Upcoming: Palette.accent,
  Past: Palette.noteTint,
};

const STATUS_DOT_COLOR: Record<ReturnType<typeof tripStatus>, string> = {
  'In progress': '#5BC27E',
  Upcoming: Palette.accent,
  Past: Palette.text3,
};

export default function TripsScreen() {
  const { trips, initialized, initialize, importTrip } = useTripStore();
  const colorScheme = useColorScheme();
  const theme = useTheme(colorScheme);

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized]);

  const onImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (!uri) return;
      const trip = await importTrip(uri);
      router.push(`/trip/${trip.id}`);
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not import this file.');
    }
  };

  if (!initialized) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ActivityIndicator style={styles.loader} size="large" />
      </SafeAreaView>
    );
  }

  // Group trips by status
  const inProgress = trips.filter((t) => tripStatus(t) === 'In progress');
  const upcoming = trips.filter((t) => tripStatus(t) === 'Upcoming');
  const past = trips.filter((t) => tripStatus(t) === 'Past');

  function renderTripCard(item: TripSummary) {
    const status = tripStatus(item);
    const dotColor = STATUS_DOT_COLOR[status];

    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => router.push(`/trip/${item.id}`)}
        activeOpacity={0.85}
        style={styles.card}
      >
        {/* Wallpaper image */}
        {item.wallpaperUri ? (
          <Image
            source={{ uri: wallpaperDisplayUri(item.wallpaperUri) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? '#2C2C2E' : '#E7E2D6' }]} />
        )}

        {/* Dark scrim — only over wallpaper images */}
        {item.wallpaperUri ? (
          <View
            testID="wallpaper-scrim"
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
          />
        ) : null}

        {/* Status pill — top right */}
        <View style={styles.statusPillWrapper}>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
            <Text style={styles.statusPillText}>{status}</Text>
          </View>
        </View>

        {/* Title overlay — bottom */}
        <View style={styles.titleOverlay}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDates}>
            {item.startDate} — {item.endDate}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { borderBottomColor: theme.sep }]}>
        <Text style={[styles.title, { color: theme.text }]}>Trips</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={onImport} accessibilityLabel="Import trip" hitSlop={8}>
            <Text style={[styles.importText, { color: theme.accent }]}>Import</Text>
          </Pressable>
          <GlassView
            glassEffectStyle="regular"
            tintColor={theme.accent}
            isInteractive
            style={styles.addButton}
          >
            <Pressable
              onPress={() => router.push('/trip/new')}
              accessibilityLabel="New trip"
              style={styles.addButtonPressable}
            >
              <Text style={styles.addButtonText}>+</Text>
            </Pressable>
          </GlassView>
        </View>
      </View>

      {trips.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.text }]}>No trips yet.</Text>
          <Text style={[styles.emptyHint, { color: theme.text2 }]}>
            Tap + to create your first trip.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {inProgress.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, { color: theme.text2 }]}>IN PROGRESS</Text>
              {inProgress.map(renderTripCard)}
            </>
          ) : null}
          {upcoming.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, { color: theme.text2 }]}>UPCOMING</Text>
              {upcoming.map(renderTripCard)}
            </>
          ) : null}
          {past.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, { color: theme.text2 }]}>PAST</Text>
              {past.map(renderTripCard)}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 28, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  importText: { fontSize: 17 },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '400' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600' },
  emptyHint: { marginTop: 8 },
  list: { paddingVertical: 8, paddingHorizontal: 16, gap: 8, paddingBottom: 120 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    height: 160,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  statusPillWrapper: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  titleOverlay: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  cardDates: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 3,
  },
});
