import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Animated,
  Keyboard,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { GlassView } from 'expo-glass-effect';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useThemeColors } from '@/constants/theme';
import { buildSchemaPrompt } from '@/lib/schema-prompt';
import { useTripStore } from '@/lib/store';

/**
 * Import Trip (ADR-0012) — the single import surface, presented as a 100%-detent
 * sheet. Two stacked sections: on top, the JSON Import — either pick a trip
 * `.json` file or paste the JSON directly, both validated through the store
 * against the strict `TripSchema` gate (fresh id, human-readable error on invalid
 * input). Pasting covers the case where an AI returns the trip as chat text rather
 * than a downloadable file. Below it, the Schema Prompt round trip: copy a
 * ready-to-paste prompt, take it to any external LLM with a free-text trip plan,
 * and bring the result back in here. The app makes no network call; the user
 * carries the text across by hand.
 */
// Clears the transparent native nav bar so body content doesn't render under the
// title (matches the trips/settings sheets).
const NAV_BAR_HEIGHT = 64;
// How long the Copy Prompt button stays on its "Copied" checkmark before reverting.
const COPIED_FEEDBACK_MS = 2000;

export default function ImportSheet() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { importTrip, importTripText, setDisplayedTrip } = useTripStore();
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The paste path: a text area for JSON an AI returned as chat text. Toggled on
  // from the primary section; `busy` guards against a double-submit while the
  // import runs.
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  // Track keyboard height directly (not KeyboardAvoidingView): inside a formSheet
  // the avoider under-pads, so the Import button hides behind the keyboard. The
  // willShow/willHide frame height is measured to the screen bottom, so padding
  // the body by it lifts the button to just above the keyboard.
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

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

  // Import pasted JSON through the same TripSchema gate as a file. A malformed
  // paste surfaces the field-level error and keeps the text so it can be fixed.
  const onProcessPaste = useCallback(async () => {
    const raw = pasteText.trim();
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
  }, [pasteText, busy, importTripText, setDisplayedTrip]);

  const closePaste = useCallback(() => {
    Keyboard.dismiss();
    setPasting(false);
    setPasteText('');
    setBusy(false);
  }, []);

  const onCopyPrompt = useCallback(async () => {
    // setStringAsync resolves false on a failed write and can reject outright.
    // On success the button itself confirms (morphs to a checkmark) — no popup;
    // only a failure interrupts with an alert.
    let ok = false;
    try {
      ok = await Clipboard.setStringAsync(buildSchemaPrompt());
    } catch {
      ok = false;
    }
    if (ok) {
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } else {
      Alert.alert('Couldn’t copy', 'Something went wrong copying the prompt. Please try again.');
    }
  }, []);

  // Paste view: a full-height compose area replacing the options while the user
  // pastes and processes the JSON. The bottom padding follows the keyboard so the
  // Import button rises above it.
  if (pasting) {
    return (
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
        <Stack.Title>Import Trip</Stack.Title>
        <View
          style={[
            styles.pasteBody,
            {
              paddingTop: NAV_BAR_HEIGHT,
              paddingBottom: keyboardHeight > 0 ? keyboardHeight + 12 : insets.bottom + 16,
            },
          ]}
        >
          <Text style={[styles.detail, { color: c.textSubtle }]}>
            Paste the trip JSON your AI produced.
          </Text>
          <TextInput
            multiline
            editable={!busy}
            value={pasteText}
            onChangeText={setPasteText}
            placeholder="Paste your trip JSON…"
            placeholderTextColor={c.textSubtle}
            style={[
              styles.input,
              { color: c.text, borderColor: c.separator, backgroundColor: c.surface },
            ]}
          />
          <GlassButton
            label="Import"
            icon="square.and.arrow.down"
            accent={c.accent}
            disabled={busy || pasteText.trim().length === 0}
            onPress={onProcessPaste}
          />
          <Pressable
            accessibilityRole="button"
            onPress={closePaste}
            style={({ pressed }) => [styles.cancel, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.cancelLabel, { color: c.textSubtle }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>Import Trip</Stack.Title>

      <View
        style={[styles.body, { paddingTop: NAV_BAR_HEIGHT, paddingBottom: insets.bottom + 24 }]}
      >
        {/* Primary: add a trip from a file or pasted JSON. */}
        <View style={styles.section}>
          <Text style={[styles.heading, { color: c.text }]}>Import a trip</Text>
          <Text style={[styles.detail, { color: c.textSubtle }]}>
            Open the <Text style={styles.mono}>.json</Text> file your AI produced, or paste its
            JSON directly.
          </Text>
          <View style={styles.buttonRow}>
            <GlassButton label="Choose File" icon="folder" accent={c.accent} onPress={onPickFile} />
            <GlassButton
              label="Paste JSON"
              icon="doc.on.clipboard"
              accent={c.accent}
              onPress={() => setPasting(true)}
            />
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: c.separator }]} />

        {/* Secondary: the external-LLM round trip for an unstructured trip plan. */}
        <View style={styles.section}>
          <Text style={[styles.heading, { color: c.text }]}>Have a trip plan instead?</Text>
          <Text style={[styles.detail, { color: c.textSubtle }]}>
            Turn a free-text plan into a trip with any AI, then import the result:
          </Text>
          {/* Half-width step column so the lines wrap evenly rather than running
              the full sheet width. */}
          <View style={[styles.steps, { width: width * 0.5 }]}>
            <Step n={1} color={c.text} accent={c.accent}>
              Copy the prompt.
            </Step>
            <Step n={2} color={c.text} accent={c.accent}>
              Paste it into your favorite AI chat with your trip plan.
            </Step>
            <Step n={3} color={c.text} accent={c.accent}>
              Download the file it produces and import it here.
            </Step>
          </View>
          <GlassButton
            label={copied ? 'Copied' : 'Copy Prompt'}
            icon={copied ? 'checkmark' : 'doc.on.doc'}
            accent={c.accent}
            onPress={onCopyPrompt}
          />
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
  children: ReactNode;
}) {
  return (
    <View style={styles.step}>
      <Text style={[styles.stepNumber, { color: accent }]}>{n}.</Text>
      <Text style={[styles.stepText, { color }]}>{children}</Text>
    </View>
  );
}

// Liquid-glass pill button: an icon + label over the clear Liquid Glass material.
// The glass fills behind via an absolute GlassView that rounds its own corners
// (clipping it with overflow:'hidden' would cut off the edge highlights that give
// Liquid Glass its look). No tint — the material stays clear and the accent-colored
// content reads on top, matching the map controls. The content springs whenever the
// icon changes, so swapping to a checkmark on copy reads as a confirmation.
function GlassButton({
  label,
  icon,
  accent,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: SymbolViewProps['name'];
  accent: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const mounted = useRef(false);

  useEffect(() => {
    // Skip the initial mount; only pop when the icon actually swaps.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    scale.setValue(0.7);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 14,
    }).start();
  }, [icon, scale]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
      ]}
    >
      <GlassView
        glassEffectStyle="regular"
        isInteractive
        style={[StyleSheet.absoluteFill, styles.glass]}
      />
      <Animated.View style={[styles.buttonContent, { transform: [{ scale }] }]}>
        <SymbolView
          name={icon}
          tintColor={accent}
          resizeMode="scaleAspectFit"
          style={styles.buttonIcon}
        />
        <Text style={[styles.buttonLabel, { color: accent }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // flex:1 so the body claims the sheet's height; the content is centered both
  // ways. (Matches the proven RN-content pattern in archived.tsx / the old
  // smart-import compose body.)
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
  // Paste compose view: a full-height column whose text area grows to fill.
  pasteBody: { flex: 1, paddingHorizontal: 24, gap: 14 },
  section: { alignSelf: 'stretch', alignItems: 'center', gap: 12 },
  heading: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  detail: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  mono: { fontFamily: 'Menlo' },
  // Generous breathing room between the two sections and the divider line.
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 32 },
  steps: { alignSelf: 'center', gap: 8 },
  // Marker hugs the text with a small gap; wrapped lines hang-indent under the
  // first line (text left-aligned, not centered, so it doesn't drift off the marker).
  step: { flexDirection: 'row', alignSelf: 'stretch', gap: 6, alignItems: 'flex-start' },
  stepNumber: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  stepText: { flex: 1, fontSize: 15, lineHeight: 21 },
  // The two import affordances sit side by side, wrapping on a narrow screen.
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  button: {
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Full capsule: a radius >= half the button height rounds the glass completely so
  // the edge highlights wrap the corners instead of being clipped flat.
  glass: { borderRadius: 999 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonIcon: { width: 18, height: 18 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  cancel: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 24 },
  cancelLabel: { fontSize: 16, fontWeight: '500' },
});
