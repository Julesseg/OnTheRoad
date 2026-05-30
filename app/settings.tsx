import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { useTripStore } from '@/lib/store';
import { MAPS_APP_LABELS } from '@/lib/maps';
import type { MapsApp } from '@/lib/schema';

const ALL_MAPS_APPS: MapsApp[] = ['apple', 'google', 'waze'];

export default function SettingsSheet() {
  const { preferredMapsApp, installedMapsApps, setPreferredMapsApp, importTrip } = useTripStore(
    (s) => ({
      preferredMapsApp: s.preferredMapsApp,
      installedMapsApps: s.installedMapsApps,
      setPreferredMapsApp: s.setPreferredMapsApp,
      importTrip: s.importTrip,
    }),
  );
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const text = isDark ? '#fff' : '#111';
  const subtext = isDark ? '#8e8e93' : '#6d6d72';
  const bg = isDark ? '#1c1c1e' : '#f2f2f7';
  const cardBg = isDark ? '#2c2c2e' : '#fff';

  async function onImport() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (uri) await importTrip(uri);
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not import this trip.');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={[styles.heading, { color: text }]}>Settings</Text>

        <Text style={[styles.sectionHeader, { color: subtext }]}>Maps app</Text>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          {ALL_MAPS_APPS.filter((app) => installedMapsApps.includes(app)).map((app, idx, arr) => (
            <React.Fragment key={app}>
              <Pressable
                role="radio"
                aria-checked={preferredMapsApp === app}
                accessibilityRole="radio"
                accessibilityState={{ checked: preferredMapsApp === app }}
                accessibilityLabel={MAPS_APP_LABELS[app]}
                onPress={() => setPreferredMapsApp(app)}
                style={styles.radioRow}
              >
                <Text style={[styles.radioLabel, { color: text }]}>{MAPS_APP_LABELS[app]}</Text>
                {preferredMapsApp === app && (
                  <Text style={styles.checkmark} accessibilityHidden>✓</Text>
                )}
              </Pressable>
              {idx < arr.length - 1 && <View style={[styles.divider, { backgroundColor: isDark ? '#3a3a3c' : '#e5e5ea' }]} />}
            </React.Fragment>
          ))}
        </View>

        <Text style={[styles.sectionHeader, { color: subtext }]}>Data</Text>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Pressable
            onPress={onImport}
            accessibilityRole="button"
            accessibilityLabel="Import trip"
            style={styles.row}
          >
            <Text style={[styles.rowLabel, { color: text }]}>Import trip…</Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: isDark ? '#3a3a3c' : '#e5e5ea' }]} />
          <Pressable
            onPress={() => router.push('/archived')}
            accessibilityRole="button"
            accessibilityLabel="Archived trips"
            style={styles.row}
          >
            <Text style={[styles.rowLabel, { color: text }]}>Archived trips</Text>
            <Text style={[styles.chevron, { color: subtext }]}>›</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  radioLabel: { flex: 1, fontSize: 16 },
  checkmark: { color: '#007AFF', fontSize: 18, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { flex: 1, fontSize: 16 },
  chevron: { fontSize: 18 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});
