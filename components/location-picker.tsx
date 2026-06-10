import React, { useEffect, useRef, useState } from 'react';
import { View, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import {
  Host,
  Form,
  Section,
  Button,
  Text,
  TextField,
} from '@expo/ui/swift-ui';

import { parseLatLng, resolveMapsUrl } from '@/lib/coords';
import { searchPlaces, type PhotonResult } from '@/lib/photon';
import { AppleMaps } from 'expo-maps';
import type { Item } from '@/lib/schema';

export interface LocationPickerProps {
  initialLocation?: Item['location'];
  onConfirm: (location: Item['location']) => void;
  onCancel?: () => void;
}

type InputKind =
  | { type: 'coords'; lat: number; lng: number }
  | { type: 'resolving' }
  | { type: 'address'; text: string }
  | null;

const FALLBACK_CENTER = { lat: 39.8283, lng: -98.5795 };
const SEARCH_DEBOUNCE_MS = 250;

function classifyInput(text: string): InputKind {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const coords = parseLatLng(trimmed);
  if (coords) return { type: 'coords', lat: coords.lat, lng: coords.lng };
  if (/^https?:\/\//i.test(trimmed)) return { type: 'resolving' };
  return { type: 'address', text: trimmed };
}

export function LocationPicker({ initialLocation, onConfirm, onCancel }: LocationPickerProps) {
  const colorScheme = useColorScheme();
  const [query, setQuery] = useState('');
  const [inputKind, setInputKind] = useState<InputKind>(null);
  const [photonResults, setPhotonResults] = useState<PhotonResult[]>([]);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initialLocation?.lat != null && initialLocation?.lng != null
      ? { lat: initialLocation.lat, lng: initialLocation.lng }
      : null,
  );

  const abortRef = useRef<AbortController | null>(null);
  const resolveAbortRef = useRef<AbortController | null>(null);

  // Resolve maps URL asynchronously
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) return;
    resolveAbortRef.current?.abort();
    const ctrl = new AbortController();
    resolveAbortRef.current = ctrl;

    void resolveMapsUrl(trimmed).then((coords) => {
      if (ctrl.signal.aborted) return;
      if (coords) setInputKind({ type: 'coords', lat: coords.lat, lng: coords.lng });
      else setInputKind({ type: 'address', text: trimmed });
    });
    return () => ctrl.abort();
  }, [query]);

  // Debounced Photon search for free-text input.
  // photonResults is cleared eagerly in handleQueryChange so there's no need
  // to reset it here when kind != 'address' — that would be a synchronous setState
  // in an effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (inputKind?.type !== 'address') return;
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      searchPlaces(inputKind.text, { signal: ctrl.signal })
        .then((found) => {
          if (ctrl.signal.aborted) return;
          setPhotonResults(found);
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          setPhotonResults([]);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [inputKind]);

  function handleQueryChange(text: string) {
    abortRef.current?.abort();
    resolveAbortRef.current?.abort();
    setQuery(text);
    setPhotonResults([]);
    const trimmed = text.trim();
    if (!trimmed) {
      setInputKind(null);
      return;
    }
    const kind = classifyInput(trimmed);
    setInputKind(kind);
  }

  const center =
    pin ??
    (initialLocation?.lat != null && initialLocation?.lng != null
      ? { lat: initialLocation.lat, lng: initialLocation.lng }
      : FALLBACK_CENTER);

  if (showPin) {
    return (
      <>
        <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button accessibilityLabel="Back" onPress={() => setShowPin(false)}>
            Back
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Use pin"
            variant="prominent"
            disabled={!pin}
            onPress={() => pin && onConfirm({ lat: pin.lat, lng: pin.lng })}
          >
            Use pin
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
        <View style={{ flex: 1 }}>
          <AppleMaps.View
            style={{ flex: 1 }}
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
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      {onCancel ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button accessibilityLabel="Cancel" onPress={onCancel}>
            Cancel
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}

      <Host style={{ flex: 1 }} colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}>
        <Form>
          <Section>
            <TextField
              placeholder="Search or paste a location"
              onTextChange={handleQueryChange}
            />
          </Section>

          {inputKind?.type === 'resolving' ? (
            <Section>
              <Text>Resolving…</Text>
            </Section>
          ) : inputKind?.type === 'coords' ? (
            <Section>
              <Button
                label={`Use ${inputKind.lat}, ${inputKind.lng} as coordinates`}
                onPress={() => onConfirm({ lat: inputKind.lat, lng: inputKind.lng })}
              />
            </Section>
          ) : inputKind?.type === 'address' ? (
            <Section>
              <Button
                label={`Use '${inputKind.text}' as a plain address`}
                onPress={() => onConfirm({ address: inputKind.text })}
              />
              {photonResults.map((r, i) => (
                <Button
                  key={`${r.title}-${i}`}
                  label={r.title}
                  onPress={() =>
                    onConfirm({
                      address: r.address,
                      lat: r.coords.lat,
                      lng: r.coords.lng,
                    })
                  }
                />
              ))}
            </Section>
          ) : null}

          <Section>
            <Button label="Drop a pin on a map" onPress={() => setShowPin(true)} />
          </Section>
        </Form>
      </Host>
    </>
  );
}
