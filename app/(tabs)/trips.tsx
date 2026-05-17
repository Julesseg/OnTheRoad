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
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { useTripStore } from '@/lib/store';
import { TripSummary } from '@/lib/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';

const glassAvailable = isLiquidGlassAvailable();

export default function TripsScreen() {
  const { trips, activeTrip, initialized, initialize, setActiveTrip } = useTripStore();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized]);

  const bg = colorScheme === 'dark' ? '#000' : '#fff';

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
          renderItem={({ item }) => (
            <TripRow
              item={item}
              isActive={activeTrip?.id === item.id}
              onPress={() => setActiveTrip(item.id)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function TripRow({
  item,
  isActive,
  onPress,
}: {
  item: TripSummary;
  isActive: boolean;
  onPress: () => void;
}) {
  const inner = (
    <>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowDates}>
          {item.startDate} — {item.endDate}
        </Text>
      </View>
      {isActive && (
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>Active</Text>
        </View>
      )}
    </>
  );

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.rowWrapper}>
      {glassAvailable ? (
        <GlassView glassEffectStyle="clear" style={styles.card}>
          {inner}
        </GlassView>
      ) : (
        <View style={styles.card}>
          {inner}
        </View>
      )}
    </TouchableOpacity>
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
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '400' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#333' },
  emptyHint: { marginTop: 8, color: '#888' },
  list: { paddingVertical: 8, paddingHorizontal: 16, gap: 8 },
  rowWrapper: {},
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
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
