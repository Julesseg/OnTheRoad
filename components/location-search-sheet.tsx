import React, { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, router } from 'expo-router';
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

function sameKey(a: SelectionKey | null, b: SelectionKey): boolean {
  if (!a) return false;
  if (a.kind === 'address' && b.kind === 'address') return true;
  return a.kind === 'result' && b.kind === 'result' && a.index === b.index;
}

// The search sheet that floats over the Location Picker's full-screen map
// (ADR-0012). Its top toolbar carries X/Select, its native bottom toolbar holds
// the search field and a separate pin button, and its body lists the result rows.
// All state lives in the shared picker store so the map underneath can react.
export function LocationSearchSheet() {
  const colorScheme = useColorScheme();
  const c = useThemeColors();
  const { accent, textSubtle } = c;
  const state = usePickerStore((s) => s.state);
  const dispatch = usePickerStore((s) => s.dispatch);

  const rowList = rows(state);
  const canSelect = committedLocation(state) != null;
  const pinMode = state.mode === 'pin';

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

  // Cancel pops the sheet; the map screen underneath ends the session and returns
  // to the editor, leaving its location untouched.
  function onCancel() {
    router.back();
  }

  function onSelect() {
    usePickerStore.getState().confirm();
    router.back();
  }

  function onTogglePin() {
    dispatch(pinMode ? { type: 'cancelPinMode' } : { type: 'enterPinMode' });
  }

  return (
    <>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      {/* Native search field; rendered into the bottom toolbar via SearchBarSlot. */}
      <Stack.SearchBar
        placeholder="Search or paste a location"
        autoCapitalize="none"
        onChangeText={(e) => dispatch({ type: 'queryChanged', text: e.nativeEvent.text })}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button accessibilityLabel="Cancel" tintColor={accent} onPress={onCancel}>
          Cancel
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
      {/* Search field + pin button as separate bottom-toolbar elements. */}
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.SearchBarSlot />
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button
          accessibilityLabel="Drop a pin"
          icon="mappin.and.ellipse"
          tintColor={accent}
          selected={pinMode}
          onPress={onTogglePin}
        />
      </Stack.Toolbar>

      <Host
        style={{ flex: 1 }}
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
        modifiers={[tint(accent)]}
      >
        <Form modifiers={[scrollContentBackground('hidden'), background(c.background)]}>
          {/* In pin mode the list is empty so the map below is free for a dropped pin. */}
          {pinMode ? null : (
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
          )}
        </Form>
      </Host>
    </>
  );
}
