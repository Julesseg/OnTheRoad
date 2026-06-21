import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';

import { t } from '@/lib/i18n';
import { GlassButton } from '@/components/glass-button';
import { useThemeColors } from '@/constants/theme';
import { buildSchemaPrompt } from '@/lib/schema-prompt';
import { useTripStore } from '@/lib/store';

/**
 * Import Trip (ADR-0012) — the single import surface, presented as a 100%-detent
 * sheet. Two stacked sections: on top, the JSON Import — either pick a trip
 * `.json` file or paste the JSON directly (the latter on its own sheet), both
 * validated through the store against the strict `TripSchema` gate (fresh id,
 * human-readable error on invalid input). Pasting covers the case where an AI
 * returns the trip as chat text rather than a downloadable file. Below it, the
 * Schema Prompt round trip: copy a ready-to-paste prompt, take it to any external
 * LLM with a free-text trip plan, and bring the result back in here. The app
 * makes no network call; the user carries the text across by hand.
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
  const { importTrip, setDisplayedTrip } = useTripStore();
  const [copied, setCopied] = useState(false);
  // Blocks the sheet while the import resolves its addresses to coordinates through
  // Photon (importTrip → geocodeTripLocations), which waits on the network.
  const [resolving, setResolving] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
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
      // The file is read, validated, then its addresses geocoded — the slow part —
      // so the overlay goes up only once there's a real file to resolve.
      setResolving(true);
      const trip = await importTrip(uri);
      setDisplayedTrip(trip.id);
      router.dismissAll();
    } catch (e) {
      Alert.alert(t('import.failedTitle'), e instanceof Error ? e.message : t('import.failedBody'));
    } finally {
      setResolving(false);
    }
  }, [importTrip, setDisplayedTrip]);

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
      Alert.alert(t('import.copyFailedTitle'), t('import.copyFailedBody'));
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>{t('trips.import')}</Stack.Title>

      <View
        style={[styles.body, { paddingTop: NAV_BAR_HEIGHT, paddingBottom: insets.bottom + 24 }]}
      >
        {/* Primary: add a trip from a file or pasted JSON. */}
        <View style={styles.section}>
          <Text style={[styles.heading, { color: c.text }]}>{t('import.heading')}</Text>
          <Text style={[styles.detail, { color: c.textSubtle }]}>
            {t('import.openPrefix')}<Text style={styles.mono}>.json</Text>{t('import.openSuffix')}
          </Text>
          <View style={styles.buttonRow}>
            <GlassButton label={t('import.chooseFile')} icon="folder" accent={c.accent} onPress={onPickFile} />
            <GlassButton
              label={t('import.pasteJson')}
              icon="doc.on.clipboard"
              accent={c.accent}
              onPress={() => router.push('/import-paste')}
            />
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: c.separator }]} />

        {/* Secondary: the external-LLM round trip for an unstructured trip plan. */}
        <View style={styles.section}>
          <Text style={[styles.heading, { color: c.text }]}>{t('import.planHeading')}</Text>
          <Text style={[styles.detail, { color: c.textSubtle }]}>
            {t('import.planDetail')}
          </Text>
          {/* Half-width step column so the lines wrap evenly rather than running
              the full sheet width. */}
          <View style={[styles.steps, { width: width * 0.5 }]}>
            <Step n={1} color={c.text} accent={c.accent}>
              {t('import.step1')}
            </Step>
            <Step n={2} color={c.text} accent={c.accent}>
              {t('import.step2')}
            </Step>
            <Step n={3} color={c.text} accent={c.accent}>
              {t('import.step3')}
            </Step>
          </View>
          <GlassButton
            label={copied ? t('import.copied') : t('import.copyPrompt')}
            icon={copied ? 'checkmark' : 'doc.on.doc'}
            accent={c.accent}
            onPress={onCopyPrompt}
          />
        </View>
      </View>

      {/* Blocking import overlay: the geocode step waits on the network, so the
          sheet is covered (taps absorbed) until the trip's pins are resolved. */}
      {resolving ? (
        <View style={styles.resolvingOverlay}>
          <View style={[styles.resolvingCard, { backgroundColor: c.surface }]}>
            <ActivityIndicator color={c.accent} />
            <Text style={[styles.resolvingText, { color: c.text }]}>{t('import.resolving')}</Text>
          </View>
        </View>
      ) : null}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  // flex:1 so the body claims the sheet's height; the content is centered both
  // ways. (Matches the proven RN-content pattern of the other formSheet bodies.)
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
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

  resolvingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  resolvingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  resolvingText: { fontSize: 15, fontWeight: '500' },
});
