import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassContainer, GlassView } from 'expo-glass-effect';

import { useTripStore } from '@/lib/store';
import { TripSummary } from '@/lib/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized]);

  const bg = colorScheme === 'dark' ? '#000' : '#fff';
  const text = colorScheme === 'dark' ? '#fff' : '#111';
  const subtext = colorScheme === 'dark' ? '#aaa' : '#666';

  if (!initialized) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <ActivityIndicator style={styles.loader} size="large" />
      </SafeAreaView>
    );
  }

  const next = findNextTrip(trips);

  if (!next) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: text }]}>No upcoming trips</Text>
          <Text style={[styles.emptyHint, { color: subtext }]}>
            Create a trip in the Trips tab to get started.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const today = todayString();
  const isInProgress = next.startDate <= today && next.endDate >= today;
  const delta = daysUntil(next.startDate);

  const fullTrip = activeTrip?.id === next.id ? activeTrip : null;
  const todayDay = fullTrip?.days.find((d) => d.date === today);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <GlassContainer style={styles.glassGroup}>
          <GlassView glassEffectStyle="clear" style={styles.panel}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {isInProgress ? 'In progress' : `In ${delta} day${delta === 1 ? '' : 's'}`}
              </Text>
            </View>
            <Text style={[styles.tripTitle, { color: text }]}>{next.title}</Text>
            <Text style={[styles.dates, { color: subtext }]}>
              {next.startDate} — {next.endDate}
            </Text>
          </GlassView>

          {isInProgress && (
            <GlassView glassEffectStyle="clear" style={styles.panel}>
              <Text style={[styles.sectionTitle, { color: text }]}>Today</Text>
              {todayDay && todayDay.items.length > 0 ? (
                todayDay.items.map((item) => (
                  <View key={item.id} style={styles.item}>
                    <Text style={[styles.itemType, { color: subtext }]}>{item.type}</Text>
                    <Text style={[styles.itemName, { color: text }]}>
                      {'name' in item ? item.name : item.text}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyDay, { color: subtext }]}>
                  Nothing scheduled for today.
                </Text>
              )}
            </GlassView>
          )}
        </GlassContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1 },
  scroll: { padding: 20, gap: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyHint: { marginTop: 8, textAlign: 'center' },
  glassGroup: { gap: 12 },
  panel: {
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  tripTitle: { fontSize: 28, fontWeight: '700' },
  dates: { marginTop: 6, fontSize: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  item: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  itemType: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  itemName: { marginTop: 2, fontSize: 15 },
  emptyDay: { fontSize: 14 },
});
