import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { GlassView } from 'expo-glass-effect';

import { useThemeColors } from '@/constants/theme';
import { buildSchemaPrompt } from '@/lib/schema-prompt';
import { useTripStore } from '@/lib/store';

/**
 * Import Trip (ADR-0012) — the single import surface, presented as a 100%-detent
 * sheet. Two stacked sections: on top, the JSON Import (pick a trip `.json` file,
 * validated through the store's `importTrip` against the strict `TripSchema`
 * gate — fresh id, human-readable error on invalid files). Below it, the Schema
 * Prompt round trip: copy a ready-to-paste prompt, take it to any external LLM
 * along with a free-text trip plan, and bring the JSON it returns back in through
 * the same file picker. The app makes no network call; the user carries the text
 * across by hand.
 */
// Clears the transparent native nav bar so body content doesn't render under the
// title (matches the trips/settings sheets).
const NAV_BAR_HEIGHT = 64;

export default function ImportSheet() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { importTrip, setDisplayedTrip } = useTripStore();

  // The JSON Import (exact restore, fresh id — see CONTEXT.md): pick a .json file,
  // validate through the store's importTrip, then open the new trip the same way
  // tapping a trip row does. Field-level validation errors surface verbatim.
  const onPickFile = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;
      const trip = await importTrip(uri);
      setDisplayedTrip(trip.id);
      router.dismissAll();
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not import this trip.');
    }
  }, [importTrip, setDisplayedTrip]);

  const onCopyPrompt = useCallback(async () => {
    // setStringAsync resolves false on a failed write and can reject outright;
    // either way the user must be told rather than fail silently or leak a
    // rejection.
    let copied = false;
    try {
      copied = await Clipboard.setStringAsync(buildSchemaPrompt());
    } catch {
      copied = false;
    }
    if (copied) {
      Alert.alert(
        'Prompt copied',
        'Paste it into any AI along with your trip plan, then import the JSON it produces here.',
      );
    } else {
      Alert.alert('Couldn’t copy', 'Something went wrong copying the prompt. Please try again.');
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>Import Trip</Stack.Title>

      <View
        style={[styles.body, { paddingTop: NAV_BAR_HEIGHT, paddingBottom: insets.bottom + 24 }]}
      >
        {/* Primary: restore an On the Road trip file. */}
        <View style={styles.section}>
          <Text style={[styles.heading, { color: c.text }]}>Import a trip file</Text>
          <Text style={[styles.detail, { color: c.textSubtle }]}>
            Choose a trip <Text style={styles.mono}>.json</Text> file to add it to your trips.
          </Text>
          <GlassButton label="Choose File" accent={c.accent} onAccent={c.onAccent} onPress={onPickFile} />
        </View>

        <View style={[styles.divider, { backgroundColor: c.separator }]} />

        {/* Secondary: the external-LLM round trip for an unstructured trip plan. */}
        <View style={styles.section}>
          <Text style={[styles.heading, { color: c.text }]}>Have a trip plan instead?</Text>
          <Text style={[styles.detail, { color: c.textSubtle }]}>
            Turn a free-text plan into a trip with any AI, then import the result:
          </Text>
          <Step n={1} color={c.text} accent={c.accent}>
            Copy the prompt.
          </Step>
          <Step n={2} color={c.text} accent={c.accent}>
            Paste it into ChatGPT, Claude, or any AI together with your trip plan.
          </Step>
          <Step n={3} color={c.text} accent={c.accent}>
            Save the JSON it produces and import it here.
          </Step>
          <GlassButton label="Copy Prompt" accent={c.accent} onAccent={c.onAccent} onPress={onCopyPrompt} />
        </View>
      </View>
    </View>
  );
}

function Step({
  n,
  color,
  accent,
  children,
}: {
  n: number;
  color: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.step}>
      <Text style={[styles.stepNumber, { color: accent }]}>{n}.</Text>
      <Text style={[styles.stepText, { color }]}>{children}</Text>
    </View>
  );
}

// Liquid-glass pill button: sized to its content, the glass material fills behind
// via an absolute GlassView rounding its own corners (clipping it would cut off
// the edge highlights that give Liquid Glass its look).
function GlassButton({
  label,
  accent,
  onAccent,
  onPress,
}: {
  label: string;
  accent: string;
  onAccent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}
    >
      <GlassView
        glassEffectStyle="regular"
        isInteractive
        tintColor={accent}
        style={[StyleSheet.absoluteFill, styles.glass]}
      />
      <Text style={[styles.buttonLabel, { color: onAccent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // flex:1 so the body claims the sheet's height (the proven pattern in
  // archived.tsx / the old smart-import compose body). The two short sections
  // fit a full-height sheet, so no ScrollView is needed.
  body: { flex: 1, paddingHorizontal: 24, gap: 24 },
  section: { gap: 12 },
  heading: { fontSize: 20, fontWeight: '700' },
  detail: { fontSize: 15, lineHeight: 21 },
  mono: { fontFamily: 'Menlo' },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  step: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  stepNumber: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  stepText: { flex: 1, fontSize: 15, lineHeight: 21 },
  button: {
    alignSelf: 'center',
    minWidth: 160,
    paddingHorizontal: 32,
    paddingVertical: 13,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Full capsule: a radius >= half the button height rounds the glass completely so
  // the edge highlights wrap the corners instead of being clipped flat.
  glass: { borderRadius: 999 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
