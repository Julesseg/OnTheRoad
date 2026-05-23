import React, { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ItemRow } from '@/components/item-row';

export default function DayDetailScreen() {
  const { id, dayId } = useLocalSearchParams<{ id: string; dayId: string }>();
  const { loadedTrips, loadTripById } = useTripStore();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (id) loadTripById(id);
  }, [id]);

  const bg = colorScheme === 'dark' ? '#000' : '#fff';
  const text = colorScheme === 'dark' ? '#fff' : '#111';
  const subtext = colorScheme === 'dark' ? '#aaa' : '#666';

  const trip = loadedTrips[id] ?? null;
  const day = trip?.days.find((d) => d.id === dayId) ?? null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: text }]}>{day ? day.date : 'Day'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!trip ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : !day || day.items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: subtext }]}>No items yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {day.items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
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
  back: { fontSize: 17, color: '#007AFF' },
  title: { fontSize: 17, fontWeight: '600' },
  headerSpacer: { width: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 16 },
  list: { paddingHorizontal: 20, paddingVertical: 8 },
});
