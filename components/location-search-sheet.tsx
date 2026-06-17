import React, { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, router, useNavigation } from 'expo-router';
import { Host, Form, Section, HStack, VStack, Spacer, Text, TextField, Button, useNativeState } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  buttonStyle,
  font,
  foregroundStyle,
  listRowBackground,
  scrollContentBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { usePickerStore } from '@/lib/location-picker-store';
import { rows, committedLocation, type SelectionKey } from '@/lib/location-picker-model';
import { parseLatLng, resolveMapsUrl } from '@/lib/coords';
import { searchPlaces } from '@/lib/photon';
import { useThemeColors } from '@/constants/theme';

const SEARCH_DEBOUNCE_MS = 250;
// The two resting detents: a medium search sheet and an XS pin-drop peek. Mode is
// derived from the resting detent (ADR-0012), so they double as the mode anchors.
const SEARCH_DETENTS = [0.1, 0.5];
const PIN_DETENT_INDEX = 0;
const SEARCH_DETENT_INDEX = 1;

function sameKey(a: SelectionKey | null, b: SelectionKey): boolean {
  if (!a) return false;
  if (a.kind === 'address' && b.kind === 'address') return true;
  return a.kind === 'result' && b.kind === 'result' && a.index === b.index;
}

// The search sheet over the Location Picker's full-screen map: a results list with
// the standing plain-address fallback row, a search field at the bottom, and a pin
// button. Selection, results, and mode all live in the shared picker store so the
// map can react. The X/Select toolbar returns the selection to the item editor.
export function LocationSearchSheet() {
  const colorScheme = useColorScheme();
  const c = useThemeColors();
  const { accent, textSubtle } = c;
  const state = usePickerStore((s) => s.state);
  const dispatch = usePickerStore((s) => s.dispatch);
  const navigation = useNavigation();

  const rowList = rows(state);
  const canSelect = committedLocation(state) != null;
  const pinMode = state.mode === 'pin';

  // The SwiftUI TextField is uncontrolled natively, and pin mode unmounts the
  // whole list+field subtree (only the toolbar shows at the 0.1 peek). Binding the
  // field to a persisted observable means that when the subtree remounts after
  // cancelling pin mode, the field still shows the restored query rather than
  // going blank while the address-fallback row reads the old text.
  const queryState = useNativeState(state.query);

  // The query text is the single source for the async work: a coordinate needs no
  // network, a URL is resolved, anything else is a live Photon search.
  const trimmed = state.query.trim();
  const isCoord = parseLatLng(trimmed) != null;
  const isUrl = /^https?:\/\//i.test(trimmed);
  const isAddress = !!trimmed && !isCoord && !isUrl;

  // Debounced Photon search for free-text input; the model auto-selects the first
  // result on arrival.
  const searchAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!isAddress) return;
    const timer = setTimeout(() => {
      searchAbort.current?.abort();
      const ctrl = new AbortController();
      searchAbort.current = ctrl;
      searchPlaces(trimmed, { signal: ctrl.signal })
        .then((found) => {
          if (!ctrl.signal.aborted) dispatch({ type: 'resultsLoaded', results: found });
        })
        .catch(() => {
          if (!ctrl.signal.aborted) dispatch({ type: 'resultsLoaded', results: [] });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      searchAbort.current?.abort();
    };
  }, [trimmed, isAddress, dispatch]);

  // Resolve a maps URL to coordinates (the model shows a transient Resolving row).
  const resolveAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!isUrl) return;
    resolveAbort.current?.abort();
    const ctrl = new AbortController();
    resolveAbort.current = ctrl;
    void resolveMapsUrl(trimmed).then((coords) => {
      if (ctrl.signal.aborted) return;
      dispatch({ type: 'urlResolved', coords: coords ?? null });
    });
    return () => ctrl.abort();
  }, [trimmed, isUrl, dispatch]);

  // Mode is derived from the resting detent (ADR-0012): a stable rest at the XS
  // peek is pin mode, back at medium is search. Read the live mode so the button-
  // and drag-driven transitions converge on this one path.
  useEffect(() => {
    const nav = navigation as unknown as {
      addListener?: (
        type: 'sheetDetentChange',
        cb: (e: { data: { index: number; stable: boolean } }) => void,
      ) => () => void;
    };
    if (!nav.addListener) return;
    return nav.addListener('sheetDetentChange', (e) => {
      if (!e.data.stable) return;
      const mode = usePickerStore.getState().state.mode;
      if (e.data.index === PIN_DETENT_INDEX && mode === 'search') dispatch({ type: 'enterPinMode' });
      if (e.data.index === SEARCH_DETENT_INDEX && mode === 'pin') dispatch({ type: 'cancelPinMode' });
    });
  }, [navigation, dispatch]);

  // The pin button and the X nudge the sheet to a detent by briefly constraining
  // the allowed detents to the target, then restoring both — react-native-screens
  // has no imperative detent setter, so this is the only programmatic path, and it
  // funnels through the same detent-derived mode transition as a manual drag.
  function nudgeToDetent(target: number) {
    const nav = navigation as unknown as { setOptions?: (o: object) => void };
    nav.setOptions?.({ sheetAllowedDetents: [target] });
    setTimeout(() => nav.setOptions?.({ sheetAllowedDetents: SEARCH_DETENTS }), 0);
  }

  function onCancel() {
    if (pinMode) {
      // X in pin mode returns to search and discards the dropped pin.
      dispatch({ type: 'cancelPinMode' });
      nudgeToDetent(SEARCH_DETENTS[SEARCH_DETENT_INDEX]);
      return;
    }
    // X in search cancels the whole pick — the editor's location is left untouched.
    router.back();
  }

  function onSelect() {
    usePickerStore.getState().confirm();
    router.back();
  }

  return (
    <>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button accessibilityLabel="Cancel" tintColor={accent} onPress={onCancel}>
          {pinMode ? 'Back' : 'Cancel'}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Select"
          variant="prominent"
          tintColor={accent}
          disabled={!canSelect}
          onPress={onSelect}
        >
          Select
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host
        style={{ flex: 1 }}
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
        modifiers={[tint(accent)]}
      >
        <Form modifiers={[scrollContentBackground('hidden'), background(c.background)]}>
          {/* Only the toolbar shows in pin mode; the list and search field are hidden
              so the map fills the screen for a hand-dropped pin. */}
          {pinMode ? null : (
            <>
              <Section modifiers={[listRowBackground(c.surface)]}>
                {rowList.map((row, i) => {
                  if (row.kind === 'resolving') {
                    return <Text key="resolving">Resolving…</Text>;
                  }
                  if (row.kind === 'result') {
                    const key: SelectionKey = { kind: 'result', index: row.index };
                    const selected = sameKey(state.selected, key);
                    return (
                      <Button key={`result-${row.index}`} onPress={() => dispatch({ type: 'selectRow', key })}>
                        <HStack>
                          <VStack alignment="leading" spacing={2}>
                            <Text>{row.result.title}</Text>
                            {row.result.address ? (
                              <Text modifiers={[font({ size: 13 }), foregroundStyle(textSubtle)]}>
                                {row.result.address}
                              </Text>
                            ) : null}
                          </VStack>
                          <Spacer />
                          {selected ? <Text modifiers={[foregroundStyle(accent)]}>✓</Text> : null}
                        </HStack>
                      </Button>
                    );
                  }
                  // The standing plain-address last resort, always at the bottom.
                  const key: SelectionKey = { kind: 'address' };
                  const selected = sameKey(state.selected, key);
                  return (
                    <Button key={`address-${i}`} onPress={() => dispatch({ type: 'selectRow', key })}>
                      <HStack>
                        <Text>{`Use '${row.text}' as a plain address`}</Text>
                        <Spacer />
                        {selected ? <Text modifiers={[foregroundStyle(accent)]}>✓</Text> : null}
                      </HStack>
                    </Button>
                  );
                })}
              </Section>

              <Section modifiers={[listRowBackground(c.surface)]}>
                <HStack spacing={8}>
                  <TextField
                    text={queryState}
                    placeholder="Search or paste a location"
                    onTextChange={(text) => dispatch({ type: 'queryChanged', text })}
                  />
                  <Button
                    label=""
                    systemImage="mappin.and.ellipse.circle"
                    onPress={() => nudgeToDetent(SEARCH_DETENTS[PIN_DETENT_INDEX])}
                    modifiers={[
                      accessibilityLabel('Drop a pin'),
                      buttonStyle('borderless'),
                      tint(textSubtle),
                    ]}
                  />
                </HStack>
              </Section>
            </>
          )}
        </Form>
      </Host>
    </>
  );
}
