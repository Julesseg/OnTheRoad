import React, { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as Sharing from 'expo-sharing';

import { useTripStore } from '@/lib/store';
import { exportTripAsFile } from '@/lib/storage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DayList } from '@/components/day-list';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loadedTrips, loadTripById } = useTripStore();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (id) loadTripById(id);
  }, [id]);

  const bg = colorScheme === 'dark' ? '#000' : '#fff';
  const text = colorScheme === 'dark' ? '#fff' : '#111';
  const subtext = colorScheme === 'dark' ? '#aaa' : '#666';

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: text }]} numberOfLines={1}>
          {trip ? trip.title : 'Trip'}
        </Text>
        {trip ? (
          <Pressable onPress={onExport} accessibilityLabel="Export trip" hitSlop={8}>
            <Text style={styles.export}>Export</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {!trip ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={[styles.dates, { color: subtext }]}>
            {trip.startDate} — {trip.endDate}
          </Text>
          <DayList
            trip={trip}
            onSelectDay={(dayId) => router.push(`/trip/${trip.id}/day/${dayId}`)}
          />
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  back: { fontSize: 17, color: '#007AFF', width: 60 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  export: { fontSize: 17, color: '#007AFF', width: 60, textAlign: 'right' },
  headerSpacer: { width: 60 },
  dates: { marginBottom: 12, fontSize: 14 },
  list: { paddingVertical: 8, paddingHorizontal: 16 },
});
