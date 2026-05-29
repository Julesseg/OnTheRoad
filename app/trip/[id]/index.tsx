import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';

import { useTripStore } from '@/lib/store';
import { exportTripAsFile } from '@/lib/storage';
import { wallpaperDisplayUri } from '@/lib/storage';
import { DayList } from '@/components/day-list';
import { useTheme } from '@/constants/theme';

function StatCard({ label, value, theme }: { label: string; value: number; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={[statStyles.card, { backgroundColor: theme.card }]}>
      <Text style={[statStyles.label, { color: theme.text2 }]}>{label.toUpperCase()}</Text>
      <Text style={[statStyles.value, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
});

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loadedTrips, loadTripById } = useTripStore();
  const colorScheme = useColorScheme();
  const theme = useTheme(colorScheme);

  useEffect(() => {
    if (id) loadTripById(id);
  }, [id]);

  const trip = loadedTrips[id] ?? null;

  const onExport = async () => {
    if (!trip) return;
    try {
      const uri = await exportTripAsFile(trip.id);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/json',
          UTI: 'public.json',
          dialogTitle: `Export ${trip.title}`,
        });
      } else {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Could not export this trip.');
    }
  };

  const heroBg = theme.dark ? '#1A1A1C' : '#E7E2D6';
  const totalItems = trip ? trip.days.reduce((acc, d) => acc + d.items.length, 0) : 0;
  const totalStays = trip
    ? trip.days.reduce((acc, d) => acc + d.items.filter((i) => i.type === 'accommodation').length, 0)
    : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero / cover */}
        <View style={[styles.hero, { backgroundColor: heroBg }]}>
          {trip?.wallpaperUri ? (
            <Image
              source={{ uri: wallpaperDisplayUri(trip.wallpaperUri) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : null}

          {/* Gradient-like overlay (no linear-gradient dep) */}
          <View style={styles.heroScrimTop} />
          <View style={styles.heroScrimBottom} />

          {/* Back + export buttons */}
          <SafeAreaView style={styles.heroNav}>
            <View style={styles.heroNavRow}>
              <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={styles.glassPill}>
                <Text style={styles.glassPillText}>‹ Back</Text>
              </Pressable>
              {trip ? (
                <Pressable onPress={onExport} accessibilityLabel="Export trip" style={styles.glassPill}>
                  <Text style={styles.glassPillText}>⋯</Text>
                </Pressable>
              ) : null}
            </View>
          </SafeAreaView>

          {/* Title overlay */}
          <View style={styles.heroTitleArea}>
            <Text style={styles.heroTitle}>{trip ? trip.title : 'Trip'}</Text>
            {trip ? (
              <Text style={styles.heroDates}>
                {trip.startDate} — {trip.endDate}
              </Text>
            ) : null}
          </View>
        </View>

        {!trip ? (
          <ActivityIndicator style={styles.loader} size="large" />
        ) : (
          <>
            {/* Stats strip */}
            <View style={[styles.statsRow, { gap: 10, paddingHorizontal: 16, marginTop: 16 }]}>
              <StatCard label="Days" value={trip.days.length} theme={theme} />
              <StatCard label="Items" value={totalItems} theme={theme} />
              <StatCard label="Stays" value={totalStays} theme={theme} />
            </View>

            {/* Section header */}
            <Text style={[styles.sectionHead, { color: theme.text2 }]}>DAYS</Text>

            {/* Day list */}
            <DayList
              trip={trip}
              onSelectDay={(dayId) => router.push(`/trip/${trip.id}/day/${dayId}`)}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  hero: {
    height: 320,
    position: 'relative',
  },
  heroScrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  heroScrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  heroNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  glassPill: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
  },
  glassPillText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  heroTitleArea: {
    position: 'absolute',
    bottom: 22,
    left: 20,
    right: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  heroDates: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  loader: { flex: 1, marginTop: 60 },
  statsRow: {
    flexDirection: 'row',
  },
  sectionHead: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 10,
  },
});
