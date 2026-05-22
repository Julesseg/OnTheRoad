import React, { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DayList } from '@/components/day-list';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentTrip, viewTrip } = useTripStore();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (id) viewTrip(id);
  }, [id]);

  const bg = colorScheme === 'dark' ? '#000' : '#fff';
  const text = colorScheme === 'dark' ? '#fff' : '#111';
  const subtext = colorScheme === 'dark' ? '#aaa' : '#666';

  const trip = currentTrip?.id === id ? currentTrip : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: text }]} numberOfLines={1}>
          {trip ? trip.title : 'Trip'}
        </Text>
        <View style={styles.headerSpacer} />
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
  back: { fontSize: 17, color: '#007AFF', width: 50 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  headerSpacer: { width: 50 },
  dates: { marginBottom: 12, fontSize: 14 },
  list: { paddingVertical: 8, paddingHorizontal: 16 },
});
