import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { GlassContainer, GlassView } from 'expo-glass-effect';

import { useTripStore } from '@/lib/store';
import { TripSummary } from '@/lib/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tripStatus(trip: TripSummary): 'In progress' | 'Upcoming' | 'Past' {
  const today = todayString();
  if (trip.endDate < today) return 'Past';
  if (trip.startDate > today) return 'Upcoming';
  return 'In progress';
}

const STATUS_COLOR: Record<ReturnType<typeof tripStatus>, string> = {
  'In progress': '#34C759',
  Upcoming: '#007AFF',
  Past: '#8E8E93',
};

export default function TripsScreen() {
  const { trips, initialized, initialize } = useTripStore();
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Trips</Text>
        <GlassView
          glassEffectStyle="regular"
          tintColor="#007AFF"
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

      {trips.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: text }]}>No trips yet.</Text>
          <Text style={[styles.emptyHint, { color: subtext }]}>
            Tap + to create your first trip.
          </Text>
        </View>
      ) : (
        <GlassContainer style={styles.glassContainer}>
          <FlatList
            data={trips}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <GlassView glassEffectStyle="clear" style={styles.card}>
                <TouchableOpacity
                  onPress={() => router.push(`/trip/${item.id}`)}
                  activeOpacity={0.7}
                  style={styles.cardInner}
                >
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, { color: text }]}>{item.title}</Text>
                    <Text style={[styles.cardDates, { color: subtext }]}>
                      {item.startDate} — {item.endDate}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[tripStatus(item)] }]}>
                    <Text style={styles.statusBadgeText}>{tripStatus(item)}</Text>
                  </View>
                </TouchableOpacity>
              </GlassView>
            )}
          />
        </GlassContainer>
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
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 28, fontWeight: '700' },
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
  glassContainer: { flex: 1 },
  list: { paddingVertical: 8, paddingHorizontal: 16, gap: 8 },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardDates: { marginTop: 2, fontSize: 13 },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
