import { View, StyleSheet, Alert, useColorScheme } from 'react-native';
import { Stack, router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Host, Form, Section, Picker, Button, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { useTripStore } from '@/lib/store';
import { useThemeColors } from '@/constants/theme';
import { ProgressiveBlurView } from '@/components/progressive-blur';
import { MAPS_APP_LABELS } from '@/lib/maps';
import type { MapsApp } from '@/lib/schema';

const ALL_MAPS_APPS: MapsApp[] = ['apple', 'google', 'waze'];
// Height of the progressive-blur band behind the transparent nav bar (mirrors
// the trips and days sheets).
const NAV_BAR_HEIGHT = 64;

export default function SettingsSheet() {
  const preferredMapsApp = useTripStore((s) => s.preferredMapsApp);
  const installedMapsApps = useTripStore((s) => s.installedMapsApps);
  const setPreferredMapsApp = useTripStore((s) => s.setPreferredMapsApp);
  const importTrip = useTripStore((s) => s.importTrip);
  const setDisplayedTrip = useTripStore((s) => s.setDisplayedTrip);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = useThemeColors();
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

  // Same chrome as the trips/days sheets: a transparent native nav bar with the
  // title, plus a progressive-blur RN overlay that frosts content scrolling under it.
  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>Settings</Stack.Title>

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

      {/* Progressive blur behind the transparent nav bar (mirrors days/trips). */}
      <View pointerEvents="none" style={[styles.navBlur, { height: NAV_BAR_HEIGHT }]}>
        <ProgressiveBlurView intensity={20} layers={10} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  host: { flex: 1 },
  navBlur: { position: 'absolute', top: 0, left: 0, right: 0 },
});
