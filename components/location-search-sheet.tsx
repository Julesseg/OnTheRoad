import React, { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, router, useNavigation } from 'expo-router';
import type { SearchBarCommands } from 'react-native-screens';
import { Host, Form, Section, HStack, VStack, Spacer, Text, Button } from '@expo/ui/swift-ui';
import {
  Animation,
  animation,
  background,
  font,
  foregroundStyle,
  listRowBackground,
  scrollContentBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { usePickerStore } from '@/lib/location-picker-store';
import {
  rows,
  committedLocation,
  pinLabel,
  selectionLabel,
  type SelectionKey,
} from '@/lib/location-picker-model';
import { parseLatLng, resolveMapsUrl } from '@/lib/coords';
import { searchPlaces } from '@/lib/photon';
import { useThemeColors } from '@/constants/theme';

const SEARCH_DEBOUNCE_MS = 250;

// The sheet's peek detent (must mirror sheetAllowedDetents in app/trip/_layout.tsx):
// index 0 is the small peek where the list is out of view, index 1 the half-height
// search rest. At the peek we surface the selected row's name as the sheet title.
const PEEK_DETENT_INDEX = 0;

function sameKey(a: SelectionKey | null, b: SelectionKey): boolean {
  if (!a) return false;
  if (a.kind === 'address' && b.kind === 'address') return true;
  return a.kind === 'result' && b.kind === 'result' && a.index === b.index;
}

// The search sheet that floats over the Location Picker's full-screen map
// (ADR-0012). It rests at two detents — 0.5 for searching and a 0.1 peek that
// hands the map nearly the full screen — but the detent only resizes the sheet;
// tapping the map drops a pin at any detent. All state lives in the shared picker
// store so the map underneath can react.
export function LocationSearchSheet() {
  const colorScheme = useColorScheme();
  const c = useThemeColors();
  const { accent, textSubtle } = c;
  const navigation = useNavigation();
  const state = usePickerStore((s) => s.state);
  const dispatch = usePickerStore((s) => s.dispatch);

  const rowList = rows(state);
  // Select commits whatever is currently chosen — a search result/address or a
  // map-tapped pin — so it's armed whenever there's a committable location.
  const canSelect = committedLocation(state) != null;

  // The query text is the single source for the async work: a coordinate needs no
  // network, a URL is resolved, anything else is a live Photon search.
  const trimmed = state.query.trim();
  const isCoord = parseLatLng(trimmed) != null;
  const isUrl = /^https?:\/\//i.test(trimmed);
  const isAddress = !!trimmed && !isCoord && !isUrl;

  // The list scrolls out of view at the peek detent, so surface the selected row's
  // name as the sheet title there to keep the current choice visible; clear it at
  // the search detent where the list shows it. Track the settled detent from the
  // native sheet's onSheetDetentChanged.
  const [atPeek, setAtPeek] = React.useState(false);
  useEffect(() => {
    const unsub = navigation.addListener(
      // expo-router emits this for the native sheet's onSheetDetentChanged.
      'sheetDetentChange' as never,
      ((e: { data: { index: number; stable: boolean } }) => {
        if (e.data.stable) setAtPeek(e.data.index === PEEK_DETENT_INDEX);
      }) as never,
    );
    return unsub;
  }, [navigation]);

  const title = atPeek ? (selectionLabel(state) ?? '') : '';
  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  // The search bar is hidden at the peek detent (the title stands in for it). The
  // native field is uncontrolled and resets when it remounts, so restore the
  // current query into it once it reappears at the search detent.
  const searchBarRef = useRef<SearchBarCommands>(null);
  useEffect(() => {
    if (atPeek) return;
    const query = usePickerStore.getState().state.query;
    if (!query) return;
    const id = setTimeout(() => searchBarRef.current?.setText(query), 0);
    return () => clearTimeout(id);
  }, [atPeek]);

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

  // Cancel aborts the whole pick: pop the sheet; the map screen underneath ends the
  // session and returns to the editor, leaving its location untouched.
  function onCancel() {
    router.back();
  }

  // Commit the current selection — a chosen result/address or a map-tapped pin —
  // back to the editor and dismiss the picker.
  function onSelect() {
    usePickerStore.getState().confirm();
    router.back();
  }

  // Tapping a result only selects it — the map flies to its pin for preview. The
  // commit stays an explicit Select so the user confirms the choice.
  function onPickRow(key: SelectionKey) {
    dispatch({ type: 'selectRow', key });
  }

  return (
    <>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      {/* Hidden at the peek detent, where the sheet title shows the selection
          instead; its text is restored on reappear (the native field is uncontrolled). */}
      {atPeek ? null : (
        <Stack.SearchBar
          ref={searchBarRef}
          placeholder="Search or paste a location"
          autoCapitalize="none"
          // Keep the navigation bar (and its Cancel/Select buttons) on screen while
          // the search field is active — by default the search controller hides it.
          hideNavigationBar={false}
          onChangeText={(e) => dispatch({ type: 'queryChanged', text: e.nativeEvent.text })}
        />
      )}

      {/* Top-bar controls. Cancel aborts the pick; Select commits the current
          selection (a result/address or a map-tapped pin) — armed whenever there's
          something committable. */}
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

      {/* The search field stretches the full width of the bottom toolbar. */}
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.SearchBarSlot />
      </Stack.Toolbar>

      <Host
        style={{ flex: 1 }}
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
        modifiers={[tint(accent)]}
      >
        {/* Hide the list's system background and wash it with translucent glass so
            the sheet reads as liquid glass over the map. */}
        <Form modifiers={[scrollContentBackground('hidden'), background(c.backgroundGlass)]}>
          {
            <Section
              modifiers={[
                listRowBackground(c.surfaceGlass),
                // Animate the map-tapped pin row sliding in/out as the pin appears.
                animation(Animation.default, state.pin != null),
              ]}
            >
              {rowList.map((row, i) => {
                if (row.kind === 'pin') {
                  const key: SelectionKey = { kind: 'pin' };
                  const selected = sameKey(state.selected, key);
                  return (
                    <Button key="pin" onPress={() => onPickRow(key)}>
                      <HStack>
                        <Text>{pinLabel(row.coords)}</Text>
                        <Spacer />
                        {selected ? <Text modifiers={[foregroundStyle(accent)]}>✓</Text> : null}
                      </HStack>
                    </Button>
                  );
                }
                if (row.kind === 'resolving') {
                  return <Text key="resolving">Resolving…</Text>;
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
          }
        </Form>
      </Host>
    </>
  );
}
