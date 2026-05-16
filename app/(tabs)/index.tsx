import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { TripSummary } from '@/lib/schema';

export default function TripsScreen() {
  const { trips, initialized, initialize, setActiveTrip } = useTripStore();

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trips</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/trip/new')}
          accessibilityLabel="New trip"
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {trips.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No trips yet.</Text>
          <Text style={styles.emptyHint}>Tap + to create your first trip.</Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <TripRow item={item} onPress={() => setActiveTrip(item.id)} />}
        />
      )}
    </SafeAreaView>
  );
}

function TripRow({ item, onPress }: { item: TripSummary; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowDates}>
          {item.startDate} — {item.endDate}
        </Text>
      </View>
      {item.isActive && (
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>Active</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
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
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '400' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#333' },
  emptyHint: { marginTop: 8, color: '#888' },
  list: { paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowDates: { marginTop: 2, fontSize: 13, color: '#666' },
  activeBadge: {
    backgroundColor: '#34C759',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  activeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
