import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { GlassView } from 'expo-glass-effect';

import { useThemeColors } from '@/constants/theme';
import { buildSchemaPrompt } from '@/lib/schema-prompt';
import { smartImportTrip } from '@/lib/smart-import';
import { useTripStore } from '@/lib/store';
import {
  getSmartImportAvailability,
  smartImportUnavailableMessage,
} from '@/lib/smart-import-availability';

/**
 * Smart Import (user-facing: Import Planning Document) — issues #96 and #97,
 * ADR-0006. When Apple Intelligence is available the screen offers a paste-text
 * input: the pasted Planning Document is structured on-device (smartImportTrip),
 * then the trip is saved and opened immediately — no review screen (PR #94
 * decision 2); corrections happen in the normal edit flows. Without Apple
 * Intelligence the entry point explains itself instead and offers a Copy Schema
 * Prompt escape hatch: a ready-to-paste prompt (the full trip JSON schema +
 * instructions) the user pastes into any AI, bringing the result back through
 * Import Trip. No network call is made here either way.
 */
// Clears the transparent native nav bar so body content doesn't render under the
// title (matches the trips/settings/days sheets).
const NAV_BAR_HEIGHT = 64;

export default function SmartImportSheet() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { addTrip, setDisplayedTrip } = useTripStore();
  // Probe once on mount; the result drives both the gate alert and the body copy.
  const [availability] = useState(getSmartImportAvailability);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // Track keyboard height directly rather than KeyboardAvoidingView: inside a
  // formSheet the avoider's frame origin isn't the screen origin, so it
  // under-pads and the Import button stays hidden behind the keyboard. The
  // willShow/willHide frame height is measured to the screen bottom, so padding
  // the body by it lifts the button exactly above the keyboard.
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Structure the pasted Planning Document on-device, then save and open the
  // trip immediately — no review screen (PR #94 decision 2). A failure (too-long
  // document, malformed output) alerts and saves nothing.
  const onImport = useCallback(async () => {
    const document = text.trim();
    if (!document || busy) return;
    setBusy(true);
    try {
      const trip = await smartImportTrip(document);
      await addTrip(trip);
      setDisplayedTrip(trip.id);
      router.dismissAll();
    } catch (e) {
      Alert.alert(
        'Couldn’t import',
        e instanceof Error ? e.message : 'Smart Import couldn’t structure this document.',
      );
      setBusy(false);
    }
  }, [text, busy, addTrip, setDisplayedTrip]);

  const copySchemaPrompt = useCallback(async () => {
    // setStringAsync resolves false on a failed write and can reject outright;
    // either way the escape hatch must tell the user rather than fail silently
    // or leak an unhandled rejection.
    let copied = false;
    try {
      copied = await Clipboard.setStringAsync(buildSchemaPrompt());
    } catch {
      copied = false;
    }
    if (copied) {
      Alert.alert(
        'Schema Prompt copied',
        'Paste it into any AI along with your trip plan, then import the JSON it produces with Import Trip.',
      );
    } else {
      Alert.alert(
        'Couldn’t copy',
        'Something went wrong copying the Schema Prompt. Please try again.',
      );
    }
  }, []);

  useEffect(() => {
    if (availability.available) return;
    Alert.alert('Smart Import unavailable', smartImportUnavailableMessage(availability.reason), [
      { text: 'Copy Schema Prompt', onPress: copySchemaPrompt },
      { text: 'Not Now', style: 'cancel', onPress: () => router.back() },
    ]);
  }, [availability, copySchemaPrompt]);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>Import Planning Document</Stack.Title>

      {availability.available ? (
        // Bottom padding follows the keyboard so the Import button rises above
        // it; paddingTop clears the transparent nav title and, with no keyboard,
        // the bottom inset keeps the button off the home indicator.
        <View
          style={[
            styles.composeBody,
            {
              paddingTop: NAV_BAR_HEIGHT,
              paddingBottom: keyboardHeight > 0 ? keyboardHeight + 12 : insets.bottom + 16,
            },
          ]}
        >
          <Text style={[styles.detail, { color: c.textSubtle }]}>
            Paste a trip plan with dates and Smart Import will structure it into a trip, on-device.
          </Text>
          <TextInput
            multiline
            editable={!busy}
            value={text}
            onChangeText={setText}
            placeholder="Paste your trip plan…"
            placeholderTextColor={c.textSubtle}
            style={[styles.input, { color: c.text, borderColor: c.separator, backgroundColor: c.surface }]}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy || text.trim().length === 0}
            onPress={onImport}
            style={({ pressed }) => [
              styles.importButton,
              { opacity: busy || text.trim().length === 0 ? 0.5 : pressed ? 0.85 : 1 },
            ]}
          >
            <GlassView
              glassEffectStyle="regular"
              isInteractive
              tintColor={c.accent}
              style={[StyleSheet.absoluteFill, styles.glass]}
            />
            {busy ? (
              <ActivityIndicator color={c.onAccent} />
            ) : (
              <Text style={[styles.buttonLabel, { color: c.onAccent }]}>Import</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={[styles.lead, { color: c.text }]}>
            Smart Import isn’t available on this device.
          </Text>
          <Text style={[styles.detail, { color: c.textSubtle }]}>
            {smartImportUnavailableMessage(availability.reason)}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={copySchemaPrompt}
            style={({ pressed }) => [styles.importButton, { opacity: pressed ? 0.85 : 1 }]}
          >
            <GlassView
              glassEffectStyle="regular"
              isInteractive
              tintColor={c.accent}
              style={[StyleSheet.absoluteFill, styles.glass]}
            />
            <Text style={[styles.buttonLabel, { color: c.onAccent }]}>Copy Schema Prompt</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  composeBody: { flex: 1, paddingHorizontal: 20, gap: 16 },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  lead: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  detail: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  // Liquid-glass Import button: sized to its content and centered. The glass
  // material fills behind via an absolute GlassView that rounds its own corners
  // (styles.glass) — clipping it with overflow:'hidden' here would cut off the
  // glass edge highlights that give Liquid Glass its look.
  importButton: {
    alignSelf: 'center',
    minWidth: 140,
    paddingHorizontal: 32,
    paddingVertical: 13,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Full capsule: a radius >= half the button height rounds the glass completely
  // so the edge highlights wrap the corners instead of being clipped flat.
  glass: { borderRadius: 999 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
