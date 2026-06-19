import React, { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, router, useNavigation } from 'expo-router';
import { Host, Form, Section, HStack, VStack, Spacer, Text, Button } from '@expo/ui/swift-ui';
import {
  background,
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

// The two sheet detents (must mirror sheetAllowedDetents in app/trip/_layout.tsx):
// index 0 is the small "pin mode" rest, index 1 is the half-height search rest.
const PIN_DETENT_INDEX = 0;
const SEARCH_DETENT_INDEX = 1;

function sameKey(a: SelectionKey | null, b: SelectionKey): boolean {
  if (!a) return false;
  if (a.kind === 'poi' && b.kind === 'poi') return true;
  if (a.kind === 'address' && b.kind === 'address') return true;
  return a.kind === 'result' && b.kind === 'result' && a.index === b.index;
}

// The search sheet that floats over the Location Picker's full-screen map
// (ADR-0012). It rests at two detents: 0.5 for searching and 0.1 for "pin mode",
// where it shrinks out of the way so the map is clear to drop a pin. The sheet
// drives the mode both ways — the user can drag between detents, and the in-sheet
// buttons animate the detent via sheetInitialDetentIndex. All state lives in the
// shared picker store so the map underneath can react.
export function LocationSearchSheet() {
  const colorScheme = useColorScheme();
  const c = useThemeColors();
  const { accent, textSubtle } = c;
  const navigation = useNavigation();
  const state = usePickerStore((s) => s.state);
  const dispatch = usePickerStore((s) => s.dispatch);

  const rowList = rows(state);
  // Select commits whatever is currently chosen — a search result/address or a
  // dropped pin — so it's armed whenever there's a committable location.
  const canSelect = committedLocation(state) != null;
  const pinMode = state.mode === 'pin';

  // The query text is the single source for the async work: a coordinate needs no
  // network, a URL is resolved, anything else is a live Photon search.
  const trimmed = state.query.trim();
  const isCoord = parseLatLng(trimmed) != null;
  const isUrl = /^https?:\/\//i.test(trimmed);
  const isAddress = !!trimmed && !isCoord && !isUrl;

  // Drive the sheet to the detent that matches the mode. With the patched
  // react-native-screens, changing sheetInitialDetentIndex re-applies the selected
  // detent with an animation; UIKit no-ops when the sheet is already there, so this
  // stays in sync whether the mode changed by drag (below) or by a button.
  useEffect(() => {
    navigation.setOptions({
      sheetInitialDetentIndex: pinMode ? PIN_DETENT_INDEX : SEARCH_DETENT_INDEX,
    });
  }, [navigation, pinMode]);

  // The map/drag side: when the sheet settles at a detent, reflect it into the
  // mode. Idempotent dispatches (the reducer guards) keep button + drag in sync.
  useEffect(() => {
    const unsub = navigation.addListener(
      // expo-router emits this for the native sheet's onSheetDetentChanged.
      'sheetDetentChange' as never,
      ((e: { data: { index: number; stable: boolean } }) => {
        if (!e.data.stable) return;
        dispatch(
          e.data.index === PIN_DETENT_INDEX ? { type: 'enterPinMode' } : { type: 'cancelPinMode' },
        );
      }) as never,
    );
    return unsub;
  }, [navigation, dispatch]);

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

  // Abort the whole pick: pop the sheet; the map screen underneath ends the session
  // and returns to the editor, leaving its location untouched.
  function onAbort() {
    router.back();
  }

  // Cancel: in pin mode it just leaves pin mode (back to the search detent, animated
  // by the mode change); in search mode it aborts the whole pick.
  function onCancel() {
    if (pinMode) dispatch({ type: 'cancelPinMode' });
    else onAbort();
  }

  // Commit the current selection — a chosen result/address or a dropped pin — back to
  // the editor and dismiss the picker.
  function onSelect() {
    usePickerStore.getState().confirm();
    router.back();
  }

  // Enter pin mode: the sheet shrinks to its small detent so the map is clear.
  function onEnterPin() {
    dispatch({ type: 'enterPinMode' });
  }

  // Tapping a result only selects it — the map flies to its pin for preview. The
  // commit stays an explicit Select so the user confirms the choice.
  function onPickRow(key: SelectionKey) {
    dispatch({ type: 'selectRow', key });
  }

  return (
    <>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      {/* The search field lives only in search mode; in pin mode the sheet is a bare
          map-clearing rest with just the commit/cancel controls. */}
      {pinMode ? null : (
        <Stack.SearchBar
          placeholder="Search or paste a location"
          autoCapitalize="none"
          // Keep the navigation bar (and its Cancel/Select buttons) on screen while
          // the search field is active — by default the search controller hides it.
          hideNavigationBar={false}
          onChangeText={(e) => dispatch({ type: 'queryChanged', text: e.nativeEvent.text })}
        />
      )}

      {/* Top-bar controls, always present. Cancel: leaves pin mode (pin) or aborts the
          pick (search). Select: commits the current selection (a result/address or a
          dropped pin) — armed whenever there's something committable. */}
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          accessibilityLabel="Cancel"
          icon="xmark"
          tintColor={accent}
          onPress={onCancel}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Select"
          icon="checkmark"
          variant="prominent"
          tintColor={accent}
          disabled={!canSelect}
          onPress={onSelect}
        />
      </Stack.Toolbar>

      {/* Search field + pin toggle as bottom-toolbar elements (search mode only). */}
      {pinMode ? null : (
        <Stack.Toolbar placement="bottom">
          <Stack.Toolbar.SearchBarSlot />
          <Stack.Toolbar.Spacer />
          <Stack.Toolbar.Button
            accessibilityLabel="Drop a pin"
            icon="mappin.and.ellipse"
            tintColor={accent}
            onPress={onEnterPin}
          />
        </Stack.Toolbar>
      )}

      <Host
        style={{ flex: 1 }}
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
        modifiers={[tint(accent)]}
      >
        {/* Hide the list's system background and wash it with translucent glass so
            the sheet reads as liquid glass over the map. */}
        <Form modifiers={[scrollContentBackground('hidden'), background(c.backgroundGlass)]}>
          {/* In pin mode the list is empty so the map below is free for a dropped pin. */}
          {pinMode ? null : (
            <Section modifiers={[listRowBackground(c.surfaceGlass)]}>
              {rowList.map((row, i) => {
                if (row.kind === 'resolving') {
                  return <Text key="resolving">Resolving…</Text>;
                }
                if (row.kind === 'poi') {
                  const key: SelectionKey = { kind: 'poi' };
                  const selected = sameKey(state.selected, key);
                  return (
                    <Button key="poi" onPress={() => onPickRow(key)}>
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
                if (row.kind === 'result') {
                  const key: SelectionKey = { kind: 'result', index: row.index };
                  const selected = sameKey(state.selected, key);
                  return (
                    <Button key={`result-${row.index}`} onPress={() => onPickRow(key)}>
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
                const key: SelectionKey = { kind: 'address' };
                const selected = sameKey(state.selected, key);
                return (
                  <Button key={`address-${i}`} onPress={() => onPickRow(key)}>
                    <HStack>
                      <Text>{`Use '${row.text}' as a plain address`}</Text>
                      <Spacer />
                      {selected ? <Text modifiers={[foregroundStyle(accent)]}>✓</Text> : null}
                    </HStack>
                  </Button>
                );
              })}
            </Section>
          )}
        </Form>
      </Host>
    </>
  );
}
