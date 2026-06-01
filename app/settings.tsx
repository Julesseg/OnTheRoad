import { View, Text as RNText, StyleSheet, Alert, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Host, Form, Section, Picker, Button, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { useTripStore } from '@/lib/store';
import { MAPS_APP_LABELS } from '@/lib/maps';
import type { MapsApp } from '@/lib/schema';

const ALL_MAPS_APPS: MapsApp[] = ['apple', 'google', 'waze'];

export default function SettingsSheet() {
  const preferredMapsApp = useTripStore((s) => s.preferredMapsApp);
  const installedMapsApps = useTripStore((s) => s.installedMapsApps);
  const setPreferredMapsApp = useTripStore((s) => s.setPreferredMapsApp);
  const importTrip = useTripStore((s) => s.importTrip);
  const setDisplayedTrip = useTripStore((s) => s.setDisplayedTrip);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const mapsApps = ALL_MAPS_APPS.filter((app) => installedMapsApps.includes(app));

  async function onImport() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;
      const trip = await importTrip(uri);
      // Open the freshly imported trip: set it as the Displayed Trip and dismiss
      // the sheet stack back to the map (same flow as tapping a trip in the list).
      setDisplayedTrip(trip.id);
      router.dismissAll();
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not import this trip.');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7' }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <RNText style={[styles.heading, { color: isDark ? '#fff' : '#111' }]}>Settings</RNText>

        <Host style={styles.host} colorScheme={isDark ? 'dark' : 'light'}>
          <Form>
            <Section title="Maps app">
              <Picker
                label="Preferred app"
                selection={preferredMapsApp}
                onSelectionChange={(app) => setPreferredMapsApp(app as MapsApp)}
                modifiers={[pickerStyle('menu')]}
              >
                {mapsApps.map((app) => (
                  <Text key={app} modifiers={[tag(app)]}>
                    {MAPS_APP_LABELS[app]}
                  </Text>
                ))}
              </Picker>
            </Section>

            <Section title="Data">
              <Button label="Import trip…" systemImage="square.and.arrow.down" onPress={onImport} />
              <Button
                label="Archived trips"
                systemImage="archivebox"
                onPress={() => router.push('/archived')}
              />
            </Section>
          </Form>
        </Host>
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
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  host: { flex: 1 },
});
