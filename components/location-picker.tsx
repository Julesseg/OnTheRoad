import React, { useEffect, useRef, useState } from 'react';
import { View, useColorScheme, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import {
  Host,
  Form,
  HStack,
  VStack,
  Section,
  Spacer,
  Button,
  Text,
  TextField,
  RNHostView,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  Animation,
  buttonStyle,
  contentTransition,
  font,
  foregroundStyle,
  listRowBackground,
  listRowSeparator,
  tint,
} from '@expo/ui/swift-ui/modifiers';

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
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [inputKind, setInputKind] = useState<InputKind>(null);
  const [photonResults, setPhotonResults] = useState<PhotonResult[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initialLocation?.lat != null && initialLocation?.lng != null
      ? { lat: initialLocation.lat, lng: initialLocation.lng }
      : null,
  );

  const abortRef = useRef<AbortController | null>(null);
  const resolveAbortRef = useRef<AbortController | null>(null);
  const mapRef = useRef<AppleMaps.MapView>(null);
  const zoomRef = useRef(12);

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

  // Captured once: camera moves after mount go through the ref (animated),
  // so the prop must not re-derive from the pin and snap the camera.
  const [initialCenter] = useState(
    () =>
      pin ??
      (initialLocation?.lat != null && initialLocation?.lng != null
        ? { lat: initialLocation.lat, lng: initialLocation.lng }
        : FALLBACK_CENTER),
  );

  // Square map window sized to the Form row's usable width.
  const mapSide = Math.min(width - 72, 500);

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
        {/* Keyed to map visibility and pin presence so their rows animate in and out. */}
        <Form
          modifiers={[animation(Animation.spring({ duration: 0.35 }), (showMap ? 1 : 0) + (pin ? 2 : 0))]}
        >
          <Section>
            <HStack spacing={8}>
              <TextField
                placeholder="Search or paste a location"
                onTextChange={handleQueryChange}
                // Typing means searching: collapse the map so results land under the field.
                onFocusChange={(focused) => {
                  if (focused) setShowMap(false);
                }}
              />
              <Button
                label=""
                systemImage={showMap ? 'mappin.and.ellipse.circle.fill' : 'mappin.and.ellipse.circle'}
                onPress={() => setShowMap((s) => !s)}
                modifiers={[
                  accessibilityLabel('Drop a pin'),
                  buttonStyle('borderless'),
                  tint(showMap ? '#007AFF' : '#8E8E93'),
                ]}
              />
            </HStack>
            {showMap ? (
              <RNHostView matchContents>
                <View style={{ width: mapSide, height: mapSide, borderRadius: 12, overflow: 'hidden' }}>
                  <AppleMaps.View
                    ref={mapRef}
                    style={{ flex: 1 }}
                    cameraPosition={{
                      coordinates: { latitude: initialCenter.lat, longitude: initialCenter.lng },
                      zoom: 12,
                    }}
                    markers={
                      pin
                        ? [{ coordinates: { latitude: pin.lat, longitude: pin.lng }, systemImage: 'mappin' }]
                        : []
                    }
                    onCameraMove={(event) => {
                      zoomRef.current = event.zoom;
                    }}
                    onMapClick={(event) => {
                      const { latitude, longitude } = event.coordinates;
                      if (typeof latitude === 'number' && typeof longitude === 'number') {
                        setPin({ lat: latitude, lng: longitude });
                        // Imperative move animates natively (withAnimation); keep the
                        // user's zoom level rather than resetting it.
                        mapRef.current?.setCameraPosition({
                          coordinates: { latitude, longitude },
                          zoom: zoomRef.current,
                        });
                      }
                    }}
                  />
                </View>
              </RNHostView>
            ) : null}
          </Section>

          {showMap && pin ? (
            <Section modifiers={[listRowBackground('#00000000'), listRowSeparator('hidden')]}>
              <HStack>
                <Spacer />
                <Button
                  onPress={() => onConfirm({ lat: pin.lat, lng: pin.lng })}
                  modifiers={[buttonStyle('glassProminent')]}
                >
                  <HStack spacing={10}>
                    <Text>Use pin</Text>
                    <VStack alignment="center" spacing={1}>
                      <Text
                        modifiers={[
                          font({ size: 13 }),
                          contentTransition('numericText'),
                          animation(Animation.default, pin.lat),
                        ]}
                      >
                        {pin.lat.toFixed(3)}
                      </Text>
                      <Text
                        modifiers={[
                          font({ size: 13 }),
                          contentTransition('numericText'),
                          animation(Animation.default, pin.lng),
                        ]}
                      >
                        {pin.lng.toFixed(3)}
                      </Text>
                    </VStack>
                  </HStack>
                </Button>
                <Spacer />
              </HStack>
            </Section>
          ) : null}

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
                  onPress={() =>
                    onConfirm({
                      // Display-only: navigation uses the coords, so the place name
                      // alone identifies the location without the address detail.
                      address: r.title,
                      lat: r.coords.lat,
                      lng: r.coords.lng,
                    })
                  }
                >
                  <VStack alignment="leading" spacing={2}>
                    <Text>{r.title}</Text>
                    {r.address ? (
                      <Text modifiers={[font({ size: 13 }), foregroundStyle('#8E8E93')]}>
                        {r.address}
                      </Text>
                    ) : null}
                  </VStack>
                </Button>
              ))}
            </Section>
          ) : null}

        </Form>
      </Host>
    </>
  );
}
