import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

import { parseMapsUrl, type Coords } from '@/lib/coords';

type Tab = 'paste' | 'search' | 'pin';

const TAB_LABELS: Record<Tab, string> = {
  paste: 'Paste URL',
  search: 'Search',
  pin: 'Pin',
};

const PARSE_ERROR = "Couldn't read a location from that URL — try copying the share URL again.";

export interface CoordsPickerProps {
  initial?: Coords | null;
  onConfirm: (coords: Coords) => void;
  onCancel?: () => void;
}

export function CoordsPicker({ initial, onConfirm, onCancel }: CoordsPickerProps) {
  const [tab, setTab] = useState<Tab>('paste');
  const [text, setText] = useState(initial ? `${initial.lat}, ${initial.lng}` : '');
  const [parsed, setParsed] = useState<Coords | null>(initial ?? null);
  const [error, setError] = useState(false);

  function handleParse() {
    const coords = parseMapsUrl(text);
    setParsed(coords);
    setError(coords === null);
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

          <Pressable accessibilityLabel="Parse" style={styles.parseButton} onPress={handleParse}>
            <Text style={styles.parseText}>Parse</Text>
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
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>
            {tab === 'search' ? 'Search for a place' : 'Drop a pin'}
          </Text>
          <Text style={styles.placeholderText}>
            Coming soon. For now, paste a maps share link or type coordinates in the Paste URL tab.
          </Text>
        </View>
      )}
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
  placeholder: { padding: 32, alignItems: 'center' },
  placeholderTitle: { fontSize: 17, fontWeight: '600', color: '#111', marginBottom: 8 },
  placeholderText: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 21 },
});
