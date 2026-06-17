import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TripMap, type TripMapHandle } from '@/components/trip-map';
import { usePickerStore } from '@/lib/location-picker-store';
import { rows, committedLocation, cameraTarget, resultPins, type SelectionKey } from '@/lib/location-picker-model';
import { parseLatLng, resolveMapsUrl } from '@/lib/coords';
import { searchPlaces } from '@/lib/photon';
import { useThemeColors } from '@/constants/theme';
import type { Trip } from '@/lib/schema';

const SEARCH_DEBOUNCE_MS = 250;
// Lifts the selected point into the area left visible above the bottom toolbar +
// result list, so the chosen pin isn't hidden behind them.
const POINT_PANEL_FRACTION = 0.4;

function sameKey(a: SelectionKey | null, b: SelectionKey): boolean {
  if (!a) return false;
  if (a.kind === 'address' && b.kind === 'address') return true;
  return a.kind === 'result' && b.kind === 'result' && a.index === b.index;
}

// The full-screen Location Picker (ADR-0012): an edge-to-edge map with the trip's
// Pins/route greyed as context and search result pins accent on top, a native
// bottom toolbar holding the search field and a pin button, and a result list
// floating over the map. The top toolbar's X/Select cancel or return the choice.
export function LocationPickerView({ trip }: { trip: Trip | null }) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
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

  // Selection drives the camera: fly to the selected result/dropped pin, or frame
  // the greyed trip when the plain-address row is chosen (the lone zoom-out).
  const mapRef = useRef<TripMapHandle>(null);
  const target = cameraTarget(state);
  const targetKey = target ? JSON.stringify(target) : '';
  useEffect(() => {
    if (!target) return;
    if (target.kind === 'point') {
      mapRef.current?.centerOn(
        { latitude: target.coords.lat, longitude: target.coords.lng },
        { panelFraction: POINT_PANEL_FRACTION },
      );
    } else {
      mapRef.current?.recenter();
    }
    // targetKey captures the meaningful change; mapRef/target identity is stable enough.
  }, [targetKey]);

  function onCancel() {
    // Cancel the whole pick — the editor's location is left untouched.
    usePickerStore.getState().end();
    router.back();
  }

  function onSelect() {
    usePickerStore.getState().confirm();
    usePickerStore.getState().end();
    router.back();
  }

  function onTogglePin() {
    dispatch(pinMode ? { type: 'cancelPinMode' } : { type: 'enterPinMode' });
  }

  return (
    <View style={styles.container}>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      {/* Native search field; rendered into the bottom toolbar via SearchBarSlot. */}
      <Stack.SearchBar
        placeholder="Search or paste a location"
        autoCapitalize="none"
        onChangeText={(e) => dispatch({ type: 'queryChanged', text: e.nativeEvent.text })}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button accessibilityLabel="Cancel" tintColor={c.accent} onPress={onCancel}>
          Cancel
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Select"
          variant="prominent"
          tintColor={c.accent}
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
          tintColor={c.accent}
          selected={pinMode}
          onPress={onTogglePin}
        />
      </Stack.Toolbar>

      <View style={StyleSheet.absoluteFill}>
        <TripMap
          ref={mapRef}
          trip={trip}
          dimmed
          resultPins={resultPins(state)}
          droppedPin={state.droppedPin}
          onMapPress={(coords) => {
            // A map tap only drops a pin in pin mode; otherwise the map is read-only.
            if (usePickerStore.getState().state.mode === 'pin') {
              usePickerStore.getState().dispatch({ type: 'dropPin', coords });
            }
          }}
        />
      </View>

      {/* Result list floating over the map, above the bottom toolbar. Hidden in pin
          mode, where the map fills the screen for a hand-dropped pin. */}
      {!pinMode && rowList.length > 0 ? (
        <View
          pointerEvents="box-none"
          style={[styles.resultsWrap, { bottom: insets.bottom + 72 }]}
        >
          <ScrollView
            style={[styles.results, { backgroundColor: c.surface, borderColor: c.separator }]}
            keyboardShouldPersistTaps="handled"
          >
            {rowList.map((row, i) => {
              if (row.kind === 'resolving') {
                return (
                  <View key="resolving" style={styles.row}>
                    <Text style={{ color: c.textSubtle }}>Resolving…</Text>
                  </View>
                );
              }
              if (row.kind === 'result') {
                const key: SelectionKey = { kind: 'result', index: row.index };
                const selected = sameKey(state.selected, key);
                return (
                  <Pressable
                    key={`result-${row.index}`}
                    accessibilityRole="button"
                    onPress={() => dispatch({ type: 'selectRow', key })}
                    style={[styles.row, { borderTopColor: c.separator }, i > 0 && styles.rowDivider]}
                  >
                    <View style={styles.rowText}>
                      <Text style={{ color: c.text }} numberOfLines={1}>
                        {row.result.title}
                      </Text>
                      {row.result.address ? (
                        <Text style={[styles.subtitle, { color: c.textSubtle }]} numberOfLines={1}>
                          {row.result.address}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? <Text style={{ color: c.accent }}>✓</Text> : null}
                  </Pressable>
                );
              }
              const key: SelectionKey = { kind: 'address' };
              const selected = sameKey(state.selected, key);
              return (
                <Pressable
                  key={`address-${i}`}
                  accessibilityRole="button"
                  onPress={() => dispatch({ type: 'selectRow', key })}
                  style={[styles.row, { borderTopColor: c.separator }, i > 0 && styles.rowDivider]}
                >
                  <Text style={[styles.rowText, { color: c.text }]} numberOfLines={1}>
                    {`Use '${row.text}' as a plain address`}
                  </Text>
                  {selected ? <Text style={{ color: c.accent }}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  resultsWrap: { position: 'absolute', left: 16, right: 16 },
  results: { maxHeight: 260, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1 },
  subtitle: { fontSize: 13, marginTop: 2 },
});
