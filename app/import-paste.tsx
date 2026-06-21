import { useCallback, useEffect, useState } from 'react';
import { View, TextInput, Keyboard, StyleSheet, Alert, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/constants/theme';
import { useTripStore } from '@/lib/store';
import { SheetHeader, SheetHeaderIconButton } from '@/components/ui/sheet-header';

/**
 * Paste JSON (ADR-0012) — the paste path of Import Trip, presented as its own
 * form sheet over the Import sheet. For when an AI returns the trip as chat text
 * rather than a downloadable file: paste it here and confirm. The text runs
 * through the same `importTripFromText` / `TripSchema` gate as a file import
 * (fresh id, verbatim field-level error on invalid input). Cancel (✕) returns to
 * the Import sheet; confirm (✓) imports, opens the trip, and dismisses back to
 * the map. No network call.
 */
// Clears the transparent native nav bar so body content doesn't render under the
// title (matches the trips/settings/import sheets).
const NAV_BAR_HEIGHT = 64;

export default function ImportPasteSheet() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { importTripText, setDisplayedTrip } = useTripStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // Track keyboard height directly (not KeyboardAvoidingView): inside a formSheet
  // the avoider under-pads. The willShow/willHide frame height is measured to the
  // screen bottom, so padding the body by it lifts content above the keyboard.
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

  const canImport = text.trim().length > 0 && !busy;

  // Import the pasted JSON through the same TripSchema gate as a file. A malformed
  // paste surfaces the field-level error and keeps the text so it can be fixed.
  const onImport = useCallback(async () => {
    const raw = text.trim();
    if (!raw || busy) return;
    setBusy(true);
    try {
      const trip = await importTripText(raw);
      setDisplayedTrip(trip.id);
      router.dismissAll();
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not import this trip.');
      setBusy(false);
    }
  }, [text, busy, importTripText, setDisplayedTrip]);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* react-native-screens drops the native header/Stack.Toolbar on Android
          formSheets, so Android uses the in-content SheetHeader; iOS keeps the
          native header. */}
      {Platform.OS === 'android' ? (
        <SheetHeader
          title="Paste JSON"
          left={
            <SheetHeaderIconButton
              icon="xmark"
              accent={c.accent}
              accessibilityLabel="Cancel"
              onPress={() => router.back()}
            />
          }
          right={
            <SheetHeaderIconButton
              icon="checkmark"
              accent={c.accent}
              accessibilityLabel="Import"
              prominent
              disabled={!canImport}
              onPress={onImport}
            />
          }
        />
      ) : (
        <>
          <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
          <Stack.Title>Paste JSON</Stack.Title>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button
              icon="xmark"
              accessibilityLabel="Cancel"
              tintColor={c.accent}
              onPress={() => router.back()}
            />
          </Stack.Toolbar>
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              icon="checkmark"
              accessibilityLabel="Import"
              variant="prominent"
              tintColor={c.accent}
              disabled={!canImport}
              onPress={onImport}
            />
          </Stack.Toolbar>
        </>
      )}

      <View
        style={[
          styles.body,
          {
            paddingTop: Platform.OS === 'android' ? 0 : NAV_BAR_HEIGHT,
            paddingBottom: keyboardHeight > 0 ? keyboardHeight + 12 : insets.bottom + 16,
          },
        ]}
      >
        <TextInput
          multiline
          autoFocus
          editable={!busy}
          // JSON is case- and quote-sensitive: keep iOS from "helpfully" rewriting
          // the pasted text. Smart Punctuation can still fold the delimiter quotes
          // to typographic “ ”, so the import path also normalizes (see trip-io).
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          smartInsertDelete={false}
          value={text}
          onChangeText={setText}
          placeholder="Paste your trip JSON…"
          placeholderTextColor={c.textSubtle}
          style={[
            styles.input,
            { color: c.text, borderColor: c.separator, backgroundColor: c.surface },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 20 },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
});
