import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

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
export default function SmartImportSheet() {
  const c = useThemeColors();
  const { addTrip, setDisplayedTrip } = useTripStore();
  // Probe once on mount; the result drives both the gate alert and the body copy.
  const [availability] = useState(getSmartImportAvailability);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

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
        <View style={styles.composeBody}>
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
            style={[
              styles.button,
              { backgroundColor: c.accent, opacity: busy || text.trim().length === 0 ? 0.5 : 1 },
            ]}
          >
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
            style={[styles.button, { backgroundColor: c.accent }]}
          >
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
  composeBody: { flex: 1, paddingHorizontal: 20, paddingTop: 12, gap: 16 },
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
  button: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
