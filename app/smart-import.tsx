import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { useThemeColors } from '@/constants/theme';
import { buildSchemaPrompt } from '@/lib/schema-prompt';
import {
  getSmartImportAvailability,
  smartImportUnavailableMessage,
} from '@/lib/smart-import-availability';

/**
 * Smart Import (user-facing: Import Planning Document) — the availability gate
 * and Schema Prompt hand-off (issue #96, ADR-0006). On a device without Apple
 * Intelligence the entry point explains itself instead of working and offers a
 * Copy Schema Prompt escape hatch: it puts a ready-to-paste prompt (the full
 * trip JSON schema + instructions) on the clipboard so the user can have any AI
 * produce a valid trip file and bring it back through Import Trip. No network
 * call is made here. The on-device structuring path lands in a later slice.
 */
export default function SmartImportSheet() {
  const c = useThemeColors();
  // Probe once on mount; the result drives both the gate alert and the body copy.
  const [availability] = useState(getSmartImportAvailability);

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
        <View style={styles.body}>
          <Text style={[styles.lead, { color: c.text }]}>Smart Import is ready.</Text>
          <Text style={[styles.detail, { color: c.textSubtle }]}>
            Document input lands in the next update.
          </Text>
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
  lead: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  detail: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  button: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
