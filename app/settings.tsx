import { View, StyleSheet, Linking, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Host, Form, Section, Picker, Text, Button, HStack, Spacer } from '@expo/ui/swift-ui';
import {
  background,
  foregroundStyle,
  frame,
  listRowBackground,
  multilineTextAlignment,
  padding,
  pickerStyle,
  scrollContentBackground,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { t } from '@/lib/i18n';
import { useTripStore } from '@/lib/store';
import { useThemeColors } from '@/constants/theme';
import { ProgressiveBlurView } from '@/components/progressive-blur';
import { MAPS_APP_LABELS } from '@/lib/maps';
import type { AppearanceMode, MapsApp } from '@/lib/schema';

const ALL_MAPS_APPS: MapsApp[] = ['apple', 'google', 'waze'];

// The maintainer's published support address and the deployed privacy policy.
// Both open out of the app — mailto / in-app browser. privacy.html ships from
// the repo's site/ dir, mirrored onto GitHub Pages by the build-history deploy
// (ci/assemble-build-history.mjs), so it resolves at this URL.
const SUPPORT_EMAIL = 'jsnull.dev+ontheroad@gmail.com';
const PRIVACY_URL = 'https://julesseg.github.io/OnTheRoad/privacy.html';
// TODO: replace with the real numeric App Store ID once the app is published.
// App Store review deep links key off the numeric id, not the bundle id
// (com.julesseguin.ontheroad) — so this URL is a placeholder until then.
const APP_STORE_ID = '0000000000';
const APP_STORE_REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;

// Read-only version string from the build: "1.0.0 (3)" when a build number is
// present, else just the version. buildNumber comes from app config at build
// time; nativeBuildVersion is the value baked into the installed binary.
function versionLabel(): string {
  const version = Constants.expoConfig?.version ?? '—';
  const build = Constants.expoConfig?.ios?.buildNumber ?? Constants.nativeBuildVersion;
  return build ? `${version} (${build})` : version;
}
const APPEARANCE_MODES: AppearanceMode[] = ['system', 'light', 'dark'];
const APPEARANCE_LABELS: Record<AppearanceMode, string> = {
  system: t('settings.appearanceSystem'),
  light: t('settings.appearanceLight'),
  dark: t('settings.appearanceDark'),
};
// Height of the progressive-blur band behind the transparent nav bar (mirrors
// the trips and days sheets).
const NAV_BAR_HEIGHT = 64;

export default function SettingsSheet() {
  const preferredMapsApp = useTripStore((s) => s.preferredMapsApp);
  const installedMapsApps = useTripStore((s) => s.installedMapsApps);
  const setPreferredMapsApp = useTripStore((s) => s.setPreferredMapsApp);
  const appearance = useTripStore((s) => s.appearance);
  const setAppearance = useTripStore((s) => s.setAppearance);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = useThemeColors();
  const mapsApps = ALL_MAPS_APPS.filter((app) => installedMapsApps.includes(app));

  // Same chrome as the trips/days sheets: a transparent native nav bar with the
  // title, plus a progressive-blur RN overlay that frosts content scrolling under it.
  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>{t('trips.settings')}</Stack.Title>

      {/* tint() seeds the SwiftUI accent for everything in the Host — SwiftUI
          otherwise falls back to system blue. The Form swaps its system grouped
          background for the warm theme bg; Sections paint rows with the surface. */}
      <Host style={styles.host} colorScheme={isDark ? 'dark' : 'light'} modifiers={[tint(c.accent)]}>
        <Form modifiers={[scrollContentBackground('hidden'), background(c.background)]}>
          <Section title={t('settings.mapsApp')} modifiers={[listRowBackground(c.surface)]}>
            <Picker
              label={t('settings.preferredApp')}
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

          <Section title={t('settings.appearance')} modifiers={[listRowBackground(c.surface)]}>
            <Picker
              label={t('settings.appearance')}
              selection={appearance}
              onSelectionChange={(mode) => setAppearance(mode as AppearanceMode)}
              modifiers={[pickerStyle('menu')]}
            >
              {APPEARANCE_MODES.map((mode) => (
                <Text key={mode} modifiers={[tag(mode)]}>
                  {APPEARANCE_LABELS[mode]}
                </Text>
              ))}
            </Picker>
          </Section>

          {/* About: read-only version + the standard App Store links (privacy,
              support, rate). These open out of the app — the privacy policy in
              the in-app browser, the others via the system (mail, App Store). */}
          <Section
            title={t('settings.about')}
            modifiers={[listRowBackground(c.surface)]}
            // A quiet credit, centered under the last section like a native footer.
            footer={
              <Text
                modifiers={[
                  padding({ top: 8 }),
                  frame({ maxWidth: 9999, alignment: 'center' }),
                  multilineTextAlignment('center'),
                  foregroundStyle(c.textSubtle),
                ]}
              >
                {t('settings.signature')}
              </Text>
            }
          >
            <HStack>
              <Text>{t('settings.version')}</Text>
              <Spacer />
              <Text modifiers={[foregroundStyle(c.textSubtle)]}>{versionLabel()}</Text>
            </HStack>
            <Button
              label={t('settings.privacyPolicy')}
              systemImage="hand.raised"
              onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)}
            />
            <Button
              label={t('settings.contactSupport')}
              systemImage="envelope"
              onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            />
            <Button
              label={t('settings.rateApp')}
              systemImage="star"
              onPress={() => void Linking.openURL(APP_STORE_REVIEW_URL)}
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
