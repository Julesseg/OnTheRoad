import React, { useEffect } from 'react';

import { LocationPickerView } from '@/components/location-picker-view';
import { useTripStore } from '@/lib/store';
import { effectiveTripId } from '@/lib/active-trip';
import { todayString } from '@/lib/date-utils';

// The map-centered Location Picker (ADR-0012): a single full-screen page. Resolves
// the displayed trip for the greyed context layer and hands it to the view, which
// owns the map, the bottom-toolbar search field + pin button, and the result list.
export default function LocationPickerScreen() {
  const { trips, loadedTrips, displayedTripId, activeTripId, loadTripById } = useTripStore();

  const today = todayString();
  const tripId = effectiveTripId(displayedTripId, trips, activeTripId, today);
  const summary = tripId ? (trips.find((t) => t.id === tripId) ?? null) : null;
  const trip = summary ? (loadedTrips[summary.id] ?? null) : null;
  useEffect(() => {
    if (summary) loadTripById(summary.id);
  }, [summary?.id]);

  return <LocationPickerView trip={trip} />;
}
