import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTripStore } from '@/lib/store';
import { MAPS_APP_LABELS } from '@/lib/maps';
import { useTheme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

function SettingsRow({
  icon,
  color,
  title,
  detail,
  last,
  onPress,
}: {
  icon: string;
  color: string;
  title: string;
  detail?: string;
  last?: boolean;
  onPress?: () => void;
}) {
  const colorScheme = useColorScheme();
  const theme = useTheme(colorScheme);

  return (
    <>
      <Pressable
        onPress={onPress}
        style={styles.settingsRow}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {/* Icon chip */}
        <View style={[styles.iconChip, { backgroundColor: color }]}>
          <IconSymbol name={icon as any} size={16} color="#FFFFFF" />
        </View>

        <Text style={[styles.settingsRowTitle, { color: theme.text }]}>{title}</Text>

        <View style={styles.settingsRowRight}>
          {detail ? (
            <Text style={[styles.settingsRowDetail, { color: theme.text2 }]}>{detail}</Text>
          ) : null}
          <IconSymbol name="chevron.right" size={14} color={theme.text3} />
        </View>
      </Pressable>
      {!last ? (
        <View style={[styles.rowSep, { backgroundColor: theme.sep }]} />
      ) : null}
    </>
  );
}

export default function SettingsScreen() {
  const store = useTripStore();
  const { preferredMapsApp, setPreferredMapsApp, installedMapsApps, initialized, initialize } = store;
  const trips = store.trips ?? [];
  const removeTrip = store.removeTrip;
  const colorScheme = useColorScheme();
  const theme = useTheme(colorScheme);

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized]);

  const onClearAll = () => {
    Alert.alert(
      'Clear all data',
      'This will permanently delete all trips and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: () => {
            trips.forEach((t) => removeTrip(t.id));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Large title */}
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

        {/* Navigation section */}
        <Text style={[styles.sectionLabel, { color: theme.text2 }]}>NAVIGATION</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {installedMapsApps.map((app, i) => (
            <React.Fragment key={app}>
              <Pressable
                onPress={() => setPreferredMapsApp(app)}
                accessibilityRole="button"
                accessibilityState={{ selected: preferredMapsApp === app }}
                accessibilityLabel={MAPS_APP_LABELS[app]}
                style={styles.mapsRow}
              >
                <Text style={[styles.mapsRowLabel, { color: theme.text }]}>{MAPS_APP_LABELS[app]}</Text>
                {preferredMapsApp === app ? (
                  <Text style={[styles.check, { color: theme.accent }]}>✓</Text>
                ) : null}
              </Pressable>
              {i < installedMapsApps.length - 1 ? (
                <View style={[styles.rowSep, { backgroundColor: theme.sep }]} />
              ) : null}
            </React.Fragment>
          ))}
        </View>
        <Text style={[styles.footnote, { color: theme.text2 }]}>
          Tapping an address opens this app. Long-press an address to pick the other one just once.
        </Text>

        {/* Trip data section */}
        <Text style={[styles.sectionLabel, { color: theme.text2 }]}>TRIP DATA</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <SettingsRow
            icon="square.and.arrow.up"
            color="#3A8E58"
            title="Export all trips"
            detail={`${trips.length} trips`}
          />
          <SettingsRow
            icon="square.and.arrow.down"
            color="#4A9EFF"
            title="Import from file"
          />
          <SettingsRow
            icon="trash"
            color="#D44A4A"
            title="Clear all data"
            last
            onPress={onClearAll}
          />
        </View>

        {/* About section */}
        <Text style={[styles.sectionLabel, { color: theme.text2 }]}>ABOUT</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <SettingsRow
            icon="info.circle"
            color="#8A8A93"
            title="Version"
            detail="1.0"
            last
          />
        </View>

        {/* Footer */}
        <Text style={[styles.footer, { color: theme.text2 }]}>
          OnTheRoad keeps every trip on this device. No accounts, no cloud, no sync.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  title: { fontSize: 28, fontWeight: '700', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  card: { borderRadius: 16, marginHorizontal: 16, overflow: 'hidden' },
  mapsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  mapsRowLabel: { fontSize: 16 },
  check: { fontSize: 17, fontWeight: '700' },
  rowSep: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  footnote: { marginTop: 8, marginHorizontal: 20, fontSize: 13 },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  iconChip: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRowTitle: { flex: 1, fontSize: 16 },
  settingsRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingsRowDetail: { fontSize: 15 },
  footer: {
    textAlign: 'center',
    marginTop: 28,
    fontSize: 13,
    marginHorizontal: 24,
    lineHeight: 18,
  },
});
