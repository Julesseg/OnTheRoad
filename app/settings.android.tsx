import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import {
  Host,
  Column,
  Card,
  Text,
  SingleChoiceSegmentedButtonRow,
  SegmentedButton,
} from '@expo/ui/jetpack-compose';
import { padding, paddingAll } from '@expo/ui/jetpack-compose/modifiers';

import { useTripStore } from '@/lib/store';
import { useThemeColors } from '@/constants/theme';
import { ProgressiveBlurView } from '@/components/progressive-blur';
import { MAPS_APP_LABELS } from '@/lib/maps';
import type { AppearanceMode, MapsApp } from '@/lib/schema';

// Android (Material 3) twin of settings.tsx. Same store wiring and behaviour; the
// SwiftUI Form + menu Pickers become a Column of Material Cards, each a labelled
// single-choice segmented button row (ADR-0015). The base settings.tsx (iOS) is
// untouched — Metro resolves this variant on Android.

const ALL_MAPS_APPS: MapsApp[] = ['apple', 'google', 'waze'];
const APPEARANCE_MODES: AppearanceMode[] = ['system', 'light', 'dark'];
const APPEARANCE_LABELS: Record<AppearanceMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};
const NAV_BAR_HEIGHT = 64;

function ChoiceCard<T extends string>({
  title,
  options,
  labelFor,
  value,
  onChange,
}: {
  title: string;
  options: T[];
  labelFor: (value: T) => string;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Card modifiers={[paddingAll(12)]}>
      <Column>
        <Text style={{ typography: 'titleSmall' }}>{title}</Text>
        <SingleChoiceSegmentedButtonRow>
          {options.map((option) => (
            <SegmentedButton
              key={option}
              selected={value === option}
              onClick={() => onChange(option)}
            >
              <SegmentedButton.Label>
                <Text>{labelFor(option)}</Text>
              </SegmentedButton.Label>
            </SegmentedButton>
          ))}
        </SingleChoiceSegmentedButtonRow>
      </Column>
    </Card>
  );
}

export default function SettingsSheet() {
  const preferredMapsApp = useTripStore((s) => s.preferredMapsApp);
  const installedMapsApps = useTripStore((s) => s.installedMapsApps);
  const setPreferredMapsApp = useTripStore((s) => s.setPreferredMapsApp);
  const appearance = useTripStore((s) => s.appearance);
  const setAppearance = useTripStore((s) => s.setAppearance);

  const c = useThemeColors();
  const mapsApps = ALL_MAPS_APPS.filter((app) => installedMapsApps.includes(app));

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>Settings</Stack.Title>

      <Host style={styles.host} matchContents>
        <Column modifiers={[padding(16, 12, 16, 12)]}>
          <ChoiceCard
            title="Maps app"
            options={mapsApps}
            labelFor={(app) => MAPS_APP_LABELS[app]}
            value={preferredMapsApp}
            onChange={(app) => setPreferredMapsApp(app)}
          />
          <ChoiceCard
            title="Appearance"
            options={APPEARANCE_MODES}
            labelFor={(mode) => APPEARANCE_LABELS[mode]}
            value={appearance}
            onChange={(mode) => setAppearance(mode)}
          />
        </Column>
      </Host>

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
