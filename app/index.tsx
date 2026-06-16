import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { useTripStore } from '@/lib/store';
import { TripMap, type TripMapHandle } from '@/components/trip-map';
import { PinInfoCard, mapsTargetForItem } from '@/components/pin-info-card';
import { MapControlButton } from '@/components/map-control-button';
import { useThemeColors } from '@/constants/theme';
import { effectiveTripId } from '@/lib/active-trip';
import { framedViewport } from '@/lib/framed-viewport';
import {
  panelFractionForDetent,
  SHEET_DETENTS,
  MIN_SHEET_DETENT_INDEX,
} from '@/lib/sheet-detents';
import { tripRouteCoords } from '@/lib/trip-route';
import { findLocatedItem } from '@/lib/pin-info-card';
import { todayString } from '@/lib/date-utils';
import { openInMaps } from '@/lib/maps';
import { tripCountdownBadge } from '@/lib/trip-badge';
import { todayFilterModel } from '@/lib/today-filter';
import { useShareIntake } from '@/lib/use-share-intake';
import { centerOnUser, requestUserLocationPermission } from '@/lib/user-location';

export default function HomeScreen() {
  const c = useThemeColors();
  const { trips, loadedTrips, displayedTripId, activeTripId, todayFilterOverride, sheetDetentIndex, selectedPinId, preferredMapsApp, initialized, initialize, loadTripById, setSheetDetentIndex, setSelectedPin, toggleChecklistEntry } =
    useTripStore();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized]);

  // Drain Share Extension captures in the background on launch + each foreground.
  useShareIntake();

  const tripMapRef = useRef<TripMapHandle>(null);

  // Show the traveller's own position once when-in-use permission is granted —
  // requested as the home map first appears (CONTEXT.md#user-location).
  const [showUserLocation, setShowUserLocation] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void requestUserLocationPermission(Location).then((granted) => {
      if (!cancelled) setShowUserLocation(granted);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Center-on-user: animate to the user's position when permitted, otherwise route
  // to Settings rather than dead-ending. Distinct from the scope button, which
  // reframes the trip route. Lifts the dot into the area above the sheet, matching
  // the route framing at the current detent.
  const onCenterOnUser = useCallback(async () => {
    const result = await centerOnUser(Location);
    if (result.kind === 'located') {
      tripMapRef.current?.centerOn(result.coordinates, {
        panelFraction: panelFractionForDetent(sheetDetentIndex),
      });
    } else {
      Linking.openSettings?.();
    }
  }, [sheetDetentIndex]);

  const today = todayString();
  const tripId = effectiveTripId(displayedTripId, trips, activeTripId, today);
  const summary = tripId ? (trips.find((t) => t.id === tripId) ?? null) : null;
  const trip = summary ? (loadedTrips[summary.id] ?? null) : null;

  useEffect(() => {
    if (summary) loadTripById(summary.id);
  }, [summary?.id]);

  // The /days sheet is permanent. Re-present it whenever the bare map regains
  // focus — once at startup when the store is ready, and again after the trips
  // sheet dismisses the whole stack to switch trips. Each fresh mount snaps the
  // sheet back to its 50% initial detent: react-native-screens applies
  // sheetInitialDetentIndex only on the sheet's first layout (RNSScreen.mm's
  // one-shot _sheetHasInitialDetentSet guard) and exposes no imperative
  // detent setter, so re-presenting is the only way to reset the detent.
  useFocusEffect(
    useCallback(() => {
      if (initialized) router.push('/days');
    }, [initialized]),
  );

  const badge = summary ? tripCountdownBadge(summary, today) : null;
  const filterModel = trip && badge
    ? todayFilterModel(trip.days, badge, todayFilterOverride, today)
    : { canFilter: false, active: false, activeDate: null };
  // Frame the filtered day's pins when the filter is active, but fall back to
  // the whole route when that day has no map-able locations (only
  // activities/accommodations) so the camera never collapses to the
  // empty-coords world view.
  const fullCoords = trip ? tripRouteCoords(trip) : [];
  const filteredCoords = trip && filterModel.active
    ? tripRouteCoords({ ...trip, days: trip.days.filter((d) => d.date === filterModel.activeDate) })
    : fullCoords;
  const coords = filteredCoords.length > 0 ? filteredCoords : fullCoords;

  // The tapped pin's info card, shown above the day sheet at its XS peek.
  const selectedLocated = selectedPinId ? findLocatedItem(trip, selectedPinId) : null;

  // With a pin selected, frame the camera on that pin (so it sits in the area
  // above the XS sheet); otherwise frame the whole route. Either way the frame is
  // shifted for the area the /days sheet leaves visible at its current detent — a
  // peeked (XS) sheet gives the map nearly the full screen, a medium sheet the top
  // half, a full sheet a centred map. Reframes when the detent settles.
  const selectedPinCoords =
    selectedLocated?.item.location?.lat != null && selectedLocated.item.location?.lng != null
      ? [{ lat: selectedLocated.item.location.lat, lng: selectedLocated.item.location.lng }]
      : null;
  const viewport = framedViewport(
    selectedPinCoords ?? coords,
    panelFractionForDetent(sheetDetentIndex),
  );

  // Tapping a pin shows its info card and frames the camera on it (via the viewport
  // above). Drive the sheet down to the XS peek so the card has room above it —
  // re-presenting is the only way to set the native detent (no imperative setter).
  const onSelectPin = useCallback(
    (id: string) => {
      if (!findLocatedItem(trip, id)) return;
      setSelectedPin(id);
      if (sheetDetentIndex !== MIN_SHEET_DETENT_INDEX) {
        setSheetDetentIndex(MIN_SHEET_DETENT_INDEX);
        router.dismissAll();
      }
    },
    [trip, sheetDetentIndex, setSelectedPin, setSheetDetentIndex],
  );

  // The map is interactive — pan, pinch-zoom, two-finger rotate, and two-finger
  // pitch all activate as a bundle. expo-maps' AppleMaps exposes no per-gesture
  // toggle (AppleMapsUISettings only covers compass/my-location/scale/pitch
  // buttons), so the full standard MapKit gesture set rides along. This is
  // intentional: "interactive map" here means a normal MapKit map.
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <TripMap
          ref={tripMapRef}
          trip={trip}
          viewport={viewport}
          // Any active day filter dims the other days' pins and route legs —
          // even when the filtered day has no pins of its own (the viewport
          // still falls back to the whole route so the camera doesn't collapse).
          activeDate={filterModel.active ? (filterModel.activeDate ?? undefined) : undefined}
          showUserLocation={showUserLocation}
          // Tapping a pin shows its info card; tapping empty map dismisses it.
          onSelectPin={onSelectPin}
          onDeselect={() => setSelectedPin(null)}
        />
      </View>
      {/* Manual pan/zoom persists across /days sheet re-presents and resets only
          when the framed viewport changes (trip switch, itinerary edit, or
          today-filter toggle). Recenter undoes a manual pan by re-applying the
          framed viewport. Hidden when no trip is loaded so it can't snap the
          camera to the world-view default. */}
      {trip && (
        <MapControlButton
          name="scope"
          accessibilityLabel="Recenter"
          color={c.accent}
          style={[styles.mapButton, { top: insets.top + 12 }]}
          onPress={() => tripMapRef.current?.recenter()}
        />
      )}
      {/* Center-on-user: themed glass + Ember accent to match the scope button
          (the native MapKit my-location button can't be tinted). Sits just below
          the scope button and centres on the traveller, not the trip route. */}
      <MapControlButton
        name="location.fill"
        accessibilityLabel="Center on my location"
        color={c.accent}
        style={[styles.mapButton, { top: insets.top + 12 + 44 + 12 }]}
        onPress={onCenterOnUser}
      />
      {/* Pin info card: floats just above the XS-peek day sheet (rendered after the
          map buttons so it's never hidden behind them). Dismissed by tapping empty
          map or expanding the sheet past the XS detent. */}
      {selectedLocated ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.cardWrap,
            { bottom: height * SHEET_DETENTS[MIN_SHEET_DETENT_INDEX] + 12 },
          ]}
        >
          <PinInfoCard
            item={selectedLocated.item}
            onOpen={() =>
              trip &&
              router.push({
                pathname: '/trip/[id]/item',
                params: {
                  id: trip.id,
                  dayId: selectedLocated.dayId,
                  itemId: selectedLocated.item.id,
                },
              })
            }
            onNavigate={() => {
              const target = mapsTargetForItem(selectedLocated.item);
              if (target) void openInMaps(target, { app: preferredMapsApp });
            }}
            onToggleChecklistEntry={(entryId) =>
              trip && toggleChecklistEntry(trip.id, selectedLocated.dayId, selectedLocated.item.id, entryId)
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapButton: { position: 'absolute', left: 16 },
  cardWrap: { position: 'absolute', left: 16, right: 16 },
});
