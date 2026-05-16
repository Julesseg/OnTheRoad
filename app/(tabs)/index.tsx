import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTripStore } from '@/lib/store';
import { TripSummary } from '@/lib/schema';

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function findNextTrip(trips: TripSummary[]): TripSummary | null {
  const today = todayString();
  return (
    trips
      .filter((t) => t.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null
  );
}

function daysUntil(dateStr: string): number {
  const today = new Date(todayString());
  const target = new Date(dateStr);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export default function NextTripScreen() {
  const { trips, activeTrip, initialized, initialize } = useTripStore();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized]);

  if (!initialized) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={styles.loader} size="large" />
      </SafeAreaView>
    );
  }

  const next = findNextTrip(trips);

  if (!next) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No upcoming trips</Text>
          <Text style={styles.emptyHint}>Create a trip in the Trips tab to get started.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const today = todayString();
  const isInProgress = next.startDate <= today && next.endDate >= today;
  const delta = daysUntil(next.startDate);

  // Resolve full trip data from store if it matches the active trip
  const fullTrip = activeTrip?.id === next.id ? activeTrip : null;
  const todayDay = fullTrip?.days.find((d) => d.date === today);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {isInProgress ? 'In progress' : `In ${delta} day${delta === 1 ? '' : 's'}`}
            </Text>
          </View>
          <Text style={styles.title}>{next.title}</Text>
          <Text style={styles.dates}>
            {next.startDate} — {next.endDate}
          </Text>
        </View>

        {isInProgress && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today</Text>
            {todayDay && todayDay.items.length > 0 ? (
              todayDay.items.map((item) => (
                <View key={item.id} style={styles.item}>
                  <Text style={styles.itemType}>{item.type}</Text>
                  <Text style={styles.itemName}>
                    {'name' in item ? item.name : item.text}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyDay}>Nothing scheduled for today.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1 },
  scroll: { padding: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  emptyHint: { marginTop: 8, color: '#888', textAlign: 'center' },
  header: { marginBottom: 28 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: '#111' },
  dates: { marginTop: 6, fontSize: 14, color: '#666' },
  section: { marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '600', marginBottom: 12, color: '#333' },
  item: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  itemType: { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase' },
  itemName: { marginTop: 2, fontSize: 15, color: '#111' },
  emptyDay: { color: '#888', fontSize: 14 },
});
