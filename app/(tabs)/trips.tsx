import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';

import { useTripStore } from '@/lib/store';
import { TripSummary } from '@/lib/schema';
import { tripStatus } from '@/lib/date-utils';
import { wallpaperDisplayUri } from '@/lib/storage';

const STATUS_COLOR: Record<ReturnType<typeof tripStatus>, string> = {
  'In progress': '#34C759',
  Upcoming: '#007AFF',
  Past: '#8E8E93',
};

export default function TripsScreen() {
  const { trips, initialized, initialize, importTrip } = useTripStore();
  const colorScheme = useColorScheme();

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

  const bg = colorScheme === 'dark' ? '#000' : '#fff';
  const text = colorScheme === 'dark' ? '#fff' : '#111';
  const subtext = colorScheme === 'dark' ? '#aaa' : '#666';
  // Subtle scrim tinted to the theme so the theme-colored card text keeps its
  // contrast over an arbitrary photo, without fully hiding the image.
  const scrim = colorScheme === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)';

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
        <View style={styles.headerActions}>
          <Pressable onPress={onImport} accessibilityLabel="Import trip" hitSlop={8}>
            <Text style={styles.importText}>Import</Text>
          </Pressable>
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
              <View style={[styles.card, { backgroundColor: bg }]}>
                {item.wallpaperUri ? (
                  <>
                    <Image
                      source={{ uri: wallpaperDisplayUri(item.wallpaperUri) }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                    <View
                      testID="wallpaper-scrim"
                      style={[StyleSheet.absoluteFill, { backgroundColor: scrim }]}
                    />
                  </>
                ) : null}
                <GlassView glassEffectStyle="clear" style={styles.glass}>
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
              </View>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  importText: { color: '#007AFF', fontSize: 17 },
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
  glass: { flex: 1 },
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
