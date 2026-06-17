import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { TripMap, type TripMapHandle } from '@/components/trip-map';
import { useTripStore } from '@/lib/store';
import { usePickerStore } from '@/lib/location-picker-store';
import { cameraTarget, resultPins } from '@/lib/location-picker-model';
import { effectiveTripId } from '@/lib/active-trip';
import { todayString } from '@/lib/date-utils';

// Lifts the selected point into the area the search sheet leaves visible, so the
// chosen pin sits above the sheet rather than behind it.
const SEARCH_PANEL_FRACTION = 0.5;

// The map-centered Location Picker (ADR-0012): a full-screen page showing the
// trip's Pins/route greyed as context with accent result/dropped pins on top. The
// search sheet (toolbars + result list) is presented over it. fullScreenModal so
// the map is edge-to-edge rather than inset within the editor's own modal frame.
export default function LocationPickerScreen() {
  const { trips, loadedTrips, displayedTripId, activeTripId, loadTripById } = useTripStore();
  const state = usePickerStore((s) => s.state);

  const today = todayString();
  const tripId = effectiveTripId(displayedTripId, trips, activeTripId, today);
  const summary = tripId ? (trips.find((t) => t.id === tripId) ?? null) : null;
  const trip = summary ? (loadedTrips[summary.id] ?? null) : null;
  useEffect(() => {
    if (summary) loadTripById(summary.id);
  }, [summary?.id]);

  // Present the search sheet over the map on first focus; on regaining focus (the
  // sheet dismissed by X or Select) the pick is over — end the session and return
  // to the item editor underneath. Mirrors the home screen's /days present.
  const presented = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!presented.current) {
        presented.current = true;
        router.push('/trip/location-search');
        return;
      }
      usePickerStore.getState().end();
      router.back();
    }, []),
  );

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
        { panelFraction: SEARCH_PANEL_FRACTION },
      );
    } else {
      mapRef.current?.recenter();
    }
    // targetKey captures the meaningful change; mapRef/target identity is stable enough.
  }, [targetKey]);

  return (
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
  );
}
