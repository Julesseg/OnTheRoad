import { View, StyleSheet, useColorScheme } from 'react-native';
import {
  Host,
  Column,
  Card,
  Text,
  SingleChoiceSegmentedButtonRow,
  SegmentedButton,
} from '@expo/ui/jetpack-compose';
import { padding, paddingAll, fillMaxWidth, weight } from '@expo/ui/jetpack-compose/modifiers';

import { useTripStore } from '@/lib/store';
import { useThemeColors } from '@/constants/theme';
import { androidMaterial, androidHostTheme } from '@/constants/android-material';
import { SheetHeader } from '@/components/ui/sheet-header';
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
  const c = useThemeColors();
  const m = androidMaterial(c);
  return (
    <Card modifiers={[fillMaxWidth(), paddingAll(12)]} colors={m.card}>
      <Column verticalArrangement={{ spacedBy: 10 }}>
        <Text color={c.text} style={{ typography: 'titleSmall' }}>{title}</Text>
        <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
          {options.map((option) => (
            <SegmentedButton
              key={option}
              selected={value === option}
              colors={m.segmented}
              modifiers={[weight(1)]}
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
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const mapsApps = ALL_MAPS_APPS.filter((app) => installedMapsApps.includes(app));

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <SheetHeader title="Settings" />

      {/* vertical-only matchContents: full `matchContents` wraps width too, shrinking
          each settings Card to its content. Matching height only lets width fill the
          sheet so the cards span the full width. */}
      <Host style={styles.host} matchContents={{ vertical: true }} {...androidHostTheme(c, scheme)}>
        <Column modifiers={[padding(16, 12, 16, 12)]} verticalArrangement={{ spacedBy: 16 }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  host: { flex: 1 },
});
