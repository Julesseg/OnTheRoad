import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';

import { AppleMaps } from 'expo-maps';

import { resolveMapsUrl, type Coords } from '@/lib/coords';
import { searchPlaces, type PhotonResult } from '@/lib/photon';

const FALLBACK_CENTER: Coords = { lat: 39.8283, lng: -98.5795 };

type Tab = 'paste' | 'search' | 'pin';

const TAB_LABELS: Record<Tab, string> = {
  paste: 'Paste URL',
  search: 'Search',
  pin: 'Pin',
};

const PARSE_ERROR =
  "Couldn't read a location from that link. Check the link or your connection, then try again.";

export interface CoordsPickerConfirmExtras {
  address?: string;
}

export interface CoordsPickerProps {
  initial?: Coords | null;
  onConfirm: (coords: Coords, extras?: CoordsPickerConfirmExtras) => void;
  onCancel?: () => void;
}

export function CoordsPicker({ initial, onConfirm, onCancel }: CoordsPickerProps) {
  const [tab, setTab] = useState<Tab>('paste');
  const [text, setText] = useState(initial ? `${initial.lat}, ${initial.lng}` : '');
  const [parsed, setParsed] = useState<Coords | null>(initial ?? null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleParse() {
    if (loading) return;
    setLoading(true);
    // Short links carry no coords until they redirect, so this may hit the network.
    const coords = await resolveMapsUrl(text);
    setParsed(coords);
    setError(coords === null);
    setLoading(false);
  }

  function handleConfirm() {
    if (parsed) onConfirm(parsed);
  }

  return (
    <View style={styles.container}>
      {onCancel ? (
        <View style={styles.bar}>
          <Pressable accessibilityLabel="Cancel" onPress={onCancel}>
            <Text style={styles.barText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.segments}>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === t }}
            style={[styles.segment, tab === t && styles.segmentActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
              {TAB_LABELS[t]}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'paste' ? (
        <View style={styles.body}>
          <Text style={styles.label}>Maps URL or coordinates</Text>
          <TextInput
            style={styles.input}
            accessibilityLabel="Maps URL or coordinates"
            placeholder="Paste a share link or type lat, lng"
            value={text}
            onChangeText={(v) => {
              setText(v);
              setParsed(null);
              setError(false);
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Pressable
            accessibilityLabel="Parse"
            accessibilityState={{ disabled: loading }}
            disabled={loading}
            style={[styles.parseButton, loading && styles.parseButtonLoading]}
            onPress={handleParse}
          >
            {loading ? (
              <ActivityIndicator color="#0a7ea4" />
            ) : (
              <Text style={styles.parseText}>Parse</Text>
            )}
          </Pressable>

          {parsed ? (
            <View style={styles.preview}>
              <View style={styles.previewPin} />
              <Text style={styles.previewText}>
                {parsed.lat}, {parsed.lng}
              </Text>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{PARSE_ERROR}</Text> : null}

          <Pressable
            accessibilityLabel="Use these coordinates"
            accessibilityState={{ disabled: !parsed }}
            disabled={!parsed}
            style={[styles.confirmButton, !parsed && styles.confirmDisabled]}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmText}>Use these coordinates</Text>
          </Pressable>
        </View>
      ) : tab === 'search' ? (
        <SearchTab onConfirm={onConfirm} />
      ) : (
        <PinTab initial={initial ?? null} onConfirm={onConfirm} />
      )}
    </View>
  );
}

interface PinTabProps {
  initial: Coords | null;
  onConfirm: (coords: Coords, extras?: CoordsPickerConfirmExtras) => void;
}

function PinTab({ initial, onConfirm }: PinTabProps) {
  const [pin, setPin] = useState<Coords | null>(initial);
  const center = pin ?? initial ?? FALLBACK_CENTER;

  return (
    <View style={styles.pinBody}>
      <AppleMaps.View
        style={styles.pinMap}
        cameraPosition={{
          coordinates: { latitude: center.lat, longitude: center.lng },
          zoom: 12,
        }}
        markers={
          pin
            ? [{ coordinates: { latitude: pin.lat, longitude: pin.lng }, systemImage: 'mappin' }]
            : []
        }
        onMapClick={(event) => {
          const { latitude, longitude } = event.coordinates;
          if (typeof latitude === 'number' && typeof longitude === 'number') {
            setPin({ lat: latitude, lng: longitude });
          }
        }}
      />
      <View style={styles.pinFooter}>
        <Text style={styles.pinHint}>
          {pin
            ? `Pin at ${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}. Tap the map to move it.`
            : 'Tap the map to drop a pin.'}
        </Text>
        <Pressable
          accessibilityLabel="Use these coordinates"
          accessibilityState={{ disabled: !pin }}
          disabled={!pin}
          style={[styles.confirmButton, !pin && styles.confirmDisabled]}
          onPress={() => pin && onConfirm(pin)}
        >
          <Text style={styles.confirmText}>Use these coordinates</Text>
        </Pressable>
      </View>
    </View>
  );
}

const SEARCH_DEBOUNCE_MS = 250;

interface SearchTabProps {
  onConfirm: (coords: Coords, extras?: CoordsPickerConfirmExtras) => void;
}

function SearchTab({ onConfirm }: SearchTabProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PhotonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errored, setErrored] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      searchPlaces(query, { signal: controller.signal })
        .then((found) => {
          if (controller.signal.aborted) return;
          setResults(found);
          setSearched(true);
          setLoading(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setResults([]);
          setErrored(true);
          setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  function handleQueryChange(next: string) {
    abortRef.current?.abort();
    setQuery(next);
    setResults([]);
    setErrored(false);
    if (!next.trim()) {
      setLoading(false);
      setSearched(false);
    }
  }

  return (
    <View style={styles.body}>
      <Text style={styles.label}>Search for a place</Text>
      <TextInput
        style={styles.input}
        accessibilityLabel="Search for a place"
        placeholder="Type a place name"
        value={query}
        onChangeText={handleQueryChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading ? (
        <ActivityIndicator
          accessibilityLabel="Searching"
          color="#0a7ea4"
          style={styles.searchSpinner}
        />
      ) : null}
      {errored ? (
        <Text style={styles.searchError}>
          Search unavailable — try paste-URL or drop-pin.
        </Text>
      ) : null}
      {!loading && !errored && searched && results.length === 0 ? (
        <Text style={styles.searchEmpty}>No matches. Try a different query.</Text>
      ) : null}
      <ScrollView style={styles.resultList} keyboardShouldPersistTaps="handled">
        {results.map((r, i) => (
          <Pressable
            key={`${r.title}-${i}`}
            accessibilityRole="button"
            onPress={() => onConfirm(r.coords, r.address ? { address: r.address } : undefined)}
            style={styles.resultRow}
          >
            <Text style={styles.resultTitle}>{r.title}</Text>
            {r.address ? <Text style={styles.resultAddress}>{r.address}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  bar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  barText: { fontSize: 17, color: '#007AFF' },
  segments: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 10,
    backgroundColor: '#eee',
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 14, color: '#666' },
  segmentTextActive: { color: '#111', fontWeight: '600' },
  body: { paddingHorizontal: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  parseButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#eef6fa',
  },
  parseButtonLoading: { opacity: 0.7 },
  parseText: { fontSize: 16, fontWeight: '600', color: '#0a7ea4' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  previewPin: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0a7ea4' },
  previewText: { fontSize: 16, color: '#111' },
  error: { marginTop: 18, fontSize: 14, color: '#d11' },
  confirmButton: {
    marginTop: 24,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#0a7ea4',
  },
  confirmDisabled: { backgroundColor: '#b9d7e2' },
  confirmText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  searchSpinner: { marginTop: 16 },
  searchEmpty: { marginTop: 18, fontSize: 14, color: '#666' },
  searchError: { marginTop: 18, fontSize: 14, color: '#d11' },
  resultList: { marginTop: 12 },
  resultRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  resultTitle: { fontSize: 16, color: '#111' },
  resultAddress: { marginTop: 2, fontSize: 13, color: '#666' },
  pinBody: { flex: 1 },
  pinMap: { flex: 1 },
  pinFooter: { padding: 20 },
  pinHint: { fontSize: 14, color: '#555', marginBottom: 12 },
});
