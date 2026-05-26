import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTripStore } from '@/lib/store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { MapsApp } from '@/lib/schema';

const MAPS_APPS: { value: MapsApp; label: string }[] = [
  { value: 'apple', label: 'Apple Maps' },
  { value: 'google', label: 'Google Maps' },
];

export default function SettingsScreen() {
  const { preferredMapsApp, setPreferredMapsApp, initialized, initialize } = useTripStore();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized]);

  const bg = colorScheme === 'dark' ? '#000' : '#fff';
  const text = colorScheme === 'dark' ? '#fff' : '#111';
  const subtext = colorScheme === 'dark' ? '#aaa' : '#666';
  const cardBg = colorScheme === 'dark' ? '#1c1c1e' : '#f2f2f7';
  const border = colorScheme === 'dark' ? '#333' : '#e0e0e0';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: subtext }]}>PREFERRED MAPS APP</Text>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          {MAPS_APPS.map((app, i) => (
            <Pressable
              key={app.value}
              onPress={() => setPreferredMapsApp(app.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: preferredMapsApp === app.value }}
              accessibilityLabel={app.label}
              style={[
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border },
              ]}
            >
              <Text style={[styles.rowLabel, { color: text }]}>{app.label}</Text>
              {preferredMapsApp === app.value ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          ))}
        </View>
        <Text style={[styles.footnote, { color: subtext }]}>
          Tapping an address opens this app. Long-press an address to pick the other one just once.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  section: { paddingHorizontal: 16, paddingTop: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginLeft: 4 },
  card: { borderRadius: 12, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 16 },
  check: { fontSize: 17, fontWeight: '700', color: '#0a7ea4' },
  footnote: { marginTop: 8, marginLeft: 4, fontSize: 13 },
});
