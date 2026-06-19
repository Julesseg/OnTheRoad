import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import * as Location from 'expo-location';

import { TripMap, type TripMapHandle } from '@/components/trip-map';
import { useTripStore } from '@/lib/store';
import { usePickerStore } from '@/lib/location-picker-store';
import { cameraTarget, resultPins } from '@/lib/location-picker-model';
import { effectiveTripId } from '@/lib/active-trip';
import { tripRouteCoords } from '@/lib/trip-route';
import { centerOnUser, requestUserLocationPermission } from '@/lib/user-location';
import { todayString } from '@/lib/date-utils';

// Lifts the selected point into the area the search sheet leaves visible, so the
// chosen pin sits above the sheet rather than behind it.
const SEARCH_PANEL_FRACTION = 0.5;

// A map tap is held briefly before it drops a pin, so a double-tap-to-zoom (two
// quick taps) cancels it instead of leaving a stray pin behind.
const TAP_TO_PIN_DELAY_MS = 300;

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
  // to the item editor underneath. Mirrors the home screen's /days present, except
  // this screen is itself a fullScreenModal: UIKit can't present the search sheet
  // while this modal is still sliding up (the two presentations collide and one
  // loses its animation, so everything pops in abruptly). Wait for our own
  // entrance transition to finish, then present the sheet so both ease in.
  // native-stack emits transitionEnd, but it isn't in expo-router's base
  // navigation event-map type; narrow addListener to just the signal we need.
  const navigation = useNavigation() as unknown as {
    addListener: (
      type: 'transitionEnd',
      cb: (e: { data: { closing: boolean } }) => void,
    ) => () => void;
  };
  const presented = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!presented.current) {
        presented.current = true;
        const unsub = navigation.addListener('transitionEnd', (e) => {
          if (!e.data.closing) router.push('/trip/location-search');
        });
        return unsub;
      }
      usePickerStore.getState().end();
      router.back();
    }, [navigation]),
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

  // Show the traveller's own position (when permitted) and, on first load, decide
  // the opening camera the same way the home map does: frame the trip's pins when
  // it has any, otherwise zoom in on the traveller. Runs once, after a trip (if
  // any) has loaded so the pin count is known.
  const [showUserLocation, setShowUserLocation] = useState(false);
  const didInitialCenter = useRef(false);
  useEffect(() => {
    if (didInitialCenter.current) return;
    if (summary && !trip) return; // wait for the trip to load before deciding
    didInitialCenter.current = true;
    const hasPins = trip ? tripRouteCoords(trip).length > 0 : false;
    let cancelled = false;
    void (async () => {
      const granted = await requestUserLocationPermission(Location);
      if (cancelled) return;
      setShowUserLocation(granted);
      // With no trip pins to frame, zoom in on the traveller (the route framing is
      // TripMap's default viewport when there are pins).
      if (!hasPins && granted) {
        const result = await centerOnUser(Location);
        if (!cancelled && result.kind === 'located') {
          mapRef.current?.centerOn(result.coordinates, { panelFraction: SEARCH_PANEL_FRACTION });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trip, summary]);

  // A map tap is held for TAP_TO_PIN_DELAY_MS before dropping a pin so a quick
  // double-tap (zoom) cancels it rather than leaving a stray pin.
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );
  // Cancel a pending tap-to-pin when the camera moves: a double-tap-and-hold zoom
  // (hold the second tap, swipe to zoom) drives the camera, so it must not also
  // drop a pin. A plain single tap doesn't move the camera, so its pin survives.
  const cancelPendingPin = useCallback(() => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
    }
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <TripMap
        ref={mapRef}
        trip={trip}
        dimmed
        showUserLocation={showUserLocation}
        resultPins={resultPins(state)}
        droppedPin={state.pin}
        onMapPress={(coords) => {
          // A second tap inside the window is a double-tap zoom — cancel the pending
          // pin. Otherwise drop (or move) the pin after the delay; it leads the
          // result list, auto-selected, until another row is chosen.
          if (tapTimer.current) {
            clearTimeout(tapTimer.current);
            tapTimer.current = null;
            return;
          }
          tapTimer.current = setTimeout(() => {
            tapTimer.current = null;
            usePickerStore.getState().dispatch({ type: 'mapTapped', coords });
          }, TAP_TO_PIN_DELAY_MS);
        }}
        onCameraMove={cancelPendingPin}
      />
    </View>
  );
}
