import React, { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, router, useNavigation } from 'expo-router';
import { Host, Column, Surface, Row, Spacer, Text, TextField, useNativeState } from '@expo/ui/jetpack-compose';
import { padding } from '@expo/ui/jetpack-compose/modifiers';

import { IconSymbol } from '@/components/ui/icon-symbol';
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

// Android (Material 3) twin of location-search-sheet.tsx. Same picker-store wiring,
// same async search/resolve effects, and the same Cancel/Select commit handlers; the
// SwiftUI Form + Stack.SearchBar become a Compose Column with an OutlinedTextField
// search field and a list of tappable Surface rows (ADR-0015). The base
// location-search-sheet.tsx (iOS) is untouched — Metro resolves this variant on
// Android.

const SEARCH_DEBOUNCE_MS = 250;

// The sheet's peek detent (must mirror sheetAllowedDetents in app/trip/_layout.tsx):
// index 0 is the small peek where the list is out of view, index 1 the half-height
// search rest. At the peek we surface the selected row's name as the sheet title.
const PEEK_DETENT_INDEX = 0;

function sameKey(a: SelectionKey | null, b: SelectionKey): boolean {
  if (!a) return false;
  if (a.kind === 'address' && b.kind === 'address') return true;
  if (a.kind === 'pin' && b.kind === 'pin') return true;
  if (a.kind === 'poi' && b.kind === 'poi') return true;
  return a.kind === 'result' && b.kind === 'result' && a.index === b.index;
}

// The search sheet that floats over the Location Picker's full-screen map
// (ADR-0012). It rests at two detents — 0.5 for searching and a 0.1 peek that
// hands the map nearly the full screen — but the detent only resizes the sheet;
// tapping the map drops a pin (and tapping a landmark adds it as a result) at any
// detent. All state lives in the shared picker store so the map underneath can
// react.
export function LocationSearchSheet() {
  const colorScheme = useColorScheme();
  const c = useThemeColors();
  const { accent } = c;
  const navigation = useNavigation();
  const state = usePickerStore((s) => s.state);
  const dispatch = usePickerStore((s) => s.dispatch);

  const rowList = rows(state);
  // Select commits whatever is currently chosen — a search result/address, a tapped
  // landmark, or a map-tapped pin — so it's armed whenever there's a committable
  // location.
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

  // The Compose TextField seeds from the picker store's query, so it reflects the
  // current query whenever it remounts at the search detent (the field is hidden
  // at the peek detent, where the title stands in).
  const queryState = useNativeState(state.query);

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

  // Commit the current selection — a chosen result/address, a tapped landmark, or a
  // map-tapped pin — back to the editor and dismiss the picker.
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

      {/* Top-bar controls. Cancel aborts the pick; Select commits the current
          selection (a result/address, a tapped landmark, or a map-tapped pin) —
          armed whenever there's something committable. */}
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

      <Host
        style={{ flex: 1 }}
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
        matchContents
      >
        <Column modifiers={[padding({ horizontal: 16, vertical: 12 })]}>
          {/* Hidden at the peek detent, where the sheet title shows the selection
              instead. The field is controlled by the picker store's query. */}
          {atPeek ? null : (
            <TextField
              autoFocus
              value={queryState}
              onValueChange={(text) => dispatch({ type: 'queryChanged', text })}
            >
              <TextField.Label>
                <Text>Search or paste a location</Text>
              </TextField.Label>
              <TextField.Placeholder>
                <Text>Search or paste a location</Text>
              </TextField.Placeholder>
            </TextField>
          )}

          {rowList.map((row, i) => {
            if (row.kind === 'pin') {
              const key: SelectionKey = { kind: 'pin' };
              const selected = sameKey(state.selected, key);
              return (
                <Surface key="pin" onClick={() => onPickRow(key)}>
                  <Row modifiers={[padding({ all: 12 })]}>
                    <Text>{pinLabel(row.coords)}</Text>
                    <Spacer />
                    {selected ? <IconSymbol name="checkmark" size={20} color={accent} /> : null}
                  </Row>
                </Surface>
              );
            }
            if (row.kind === 'resolving') {
              return (
                <Row key="resolving" modifiers={[padding({ all: 12 })]}>
                  <Text>Resolving…</Text>
                </Row>
              );
            }
            if (row.kind === 'poi') {
              const key: SelectionKey = { kind: 'poi' };
              const selected = sameKey(state.selected, key);
              return (
                <Surface key="poi" onClick={() => onPickRow(key)}>
                  <Row modifiers={[padding({ all: 12 })]}>
                    <Column>
                      <Text>{row.result.title}</Text>
                      {row.result.address ? <Text>{row.result.address}</Text> : null}
                    </Column>
                    <Spacer />
                    {selected ? <IconSymbol name="checkmark" size={20} color={accent} /> : null}
                  </Row>
                </Surface>
              );
            }
            if (row.kind === 'result') {
              const key: SelectionKey = { kind: 'result', index: row.index };
              const selected = sameKey(state.selected, key);
              return (
                <Surface key={`result-${row.index}`} onClick={() => onPickRow(key)}>
                  <Row modifiers={[padding({ all: 12 })]}>
                    <Column>
                      <Text>{row.result.title}</Text>
                      {row.result.address ? <Text>{row.result.address}</Text> : null}
                    </Column>
                    <Spacer />
                    {selected ? <IconSymbol name="checkmark" size={20} color={accent} /> : null}
                  </Row>
                </Surface>
              );
            }
            const key: SelectionKey = { kind: 'address' };
            const selected = sameKey(state.selected, key);
            return (
              <Surface key={`address-${i}`} onClick={() => onPickRow(key)}>
                <Row modifiers={[padding({ all: 12 })]}>
                  <Text>{`Use '${row.text}' as a plain address`}</Text>
                  <Spacer />
                  {selected ? <IconSymbol name="checkmark" size={20} color={accent} /> : null}
                </Row>
              </Surface>
            );
          })}
        </Column>
      </Host>
    </>
  );
}
