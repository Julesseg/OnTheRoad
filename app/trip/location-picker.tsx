import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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

// A map tap is held this long before it drops a pin, so a double-tap zoom
// (whether a quick double-tap or a double-tap-*and-hold* swipe) cancels it before
// it lands. The window only needs to outlast the gap between the first tap's
// release and the second tap's press, so it can stay short.
const TAP_TO_PIN_DELAY_MS = 300;

// After a second press cancels a pending pin, the gesture's trailing tap release
// (e.g. lifting the finger that ends a double-tap-to-zoom-in) still fires an
// onMapClick a moment later; ignore clicks for this long so that tail tap doesn't
// arm a fresh pin.
const GESTURE_SUPPRESS_MS = 500;

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

  // A map tap is held for TAP_TO_PIN_DELAY_MS before dropping a pin. A second
  // finger landing during that window — the second tap of a double-tap zoom, held
  // or not — cancels it outright (handled in the touch gesture below), so a zoom
  // gesture never leaves a stray pin. A plain single tap has no second press, so its
  // pin survives.
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when a second press cancels a pending pin: onMapClick events are ignored
  // until this time so the gesture's trailing tap release doesn't arm a new pin.
  const suppressClicksUntil = useRef(0);
  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );
  // A finger touched down. If a pin is already pending, this is the second press
  // of a multi-tap zoom gesture (the double-tap, with or without a hold-and-swipe):
  // cancel the pending pin immediately, and suppress the click that will fire when
  // that finger lifts. expo-maps has no press-down event and RN's own touch events
  // don't surface over the native map, so we read the press-down through a
  // gesture-handler Manual gesture: it never activates (so it never steals the map's
  // own pan/zoom) but still reports every touch-down via onTouchesDown.
  const cancelPendingPin = useCallback(() => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      suppressClicksUntil.current = Date.now() + GESTURE_SUPPRESS_MS;
    }
  }, []);
  // onTouchesDown is a deferred event handler, so reading the timer refs inside
  // cancelPendingPin is safe — but the React Compiler lint can't see that through
  // the gesture builder and reads it as a render-time ref access.
  const touchGesture = useMemo(
    () =>
      Gesture.Manual().runOnJS(true).onTouchesDown(
        // eslint-disable-next-line react-hooks/refs -- ref is read on touch, not render
        cancelPendingPin,
      ),
    [cancelPendingPin],
  );

  return (
    <GestureDetector gesture={touchGesture}>
      <View style={StyleSheet.absoluteFill}>
        <TripMap
          ref={mapRef}
          trip={trip}
          dimmed
          showUserLocation={showUserLocation}
          resultPins={resultPins(state)}
          droppedPin={state.pin}
          onMapPress={(coords) => {
            // A click arriving while we're suppressing is the trailing tap of a zoom
            // gesture (the lifted second finger) — ignore it. Otherwise arm the pin;
            // a second press during the window cancels it (onTouchesDown). It leads
            // the result list, auto-selected, until another row is chosen.
            if (Date.now() < suppressClicksUntil.current) return;
            tapTimer.current = setTimeout(() => {
              tapTimer.current = null;
              usePickerStore.getState().dispatch({ type: 'mapTapped', coords });
            }, TAP_TO_PIN_DELAY_MS);
          }}
          onPoiSelect={(poi) => {
            // Tapping a landmark adds it as the transient top row and selects it,
            // ready to commit with Select. It supersedes any hand-dropped pin.
            usePickerStore.getState().dispatch({ type: 'poiSelected', name: poi.name, coords: poi.coords });
          }}
        />
      </View>
    </GestureDetector>
  );
}
