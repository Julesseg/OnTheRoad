import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { newId } from '@/lib/id';
import { ItemEditor, type TripOption } from '@/components/item-editor';
import type { Item } from '@/lib/schema';
import { resolveActiveTrip } from '@/lib/active-trip';
import { todayString } from '@/lib/date-utils';
import { dayIdForDate } from '@/lib/trip-days';
import {
  parseShareParams,
  classifyShare,
  resolveShareCoords,
  defaultCaptureDate,
} from '@/lib/share-capture';
import type { Coords } from '@/lib/coords';

// Noon-anchored so the picker's time component can never shift the calendar day.
function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

// The Share editor (CONTEXT.md → Share editor): the ordinary item editor with a
// trip selector on top, opened by the `ontheroad://share?url=…&text=…` deep link
// (cold-start or warm) that the Share Extension fires. The shared payload is
// classified into a draft Item; the destination trip defaults to the resolved
// active trip and the day to today (or the trip's first day), both still editable.
export default function ShareEditorScreen() {
  const { url, text } = useLocalSearchParams<{ url?: string; text?: string }>();
  const { trips, loadedTrips, activeTripId, loadTripById, upsertItem, setDisplayedTrip } =
    useTripStore();
  const today = todayString();

  const payload = useMemo(() => parseShareParams({ url, text }), [url, text]);
  const draft = useMemo(() => classifyShare(payload), [payload]);

  // A maps Place with no pin yet (ADR-0007 layer 1 found none) gets its coordinates
  // resolved over the network before the editor opens, so it mounts with the pin in
  // place; `null` means resolved-to-nothing → the editor opens address-only.
  const hasPin = draft.location?.lat != null && draft.location?.lng != null;
  const needsResolve = draft.category === 'location' && !!payload.url && !hasPin;
  const [resolvedCoords, setResolvedCoords] = useState<Coords | null | undefined>(undefined);
  useEffect(() => {
    if (!needsResolve) return;
    let active = true;
    resolveShareCoords(payload).then((coords) => {
      if (active) setResolvedCoords(coords);
    });
    return () => {
      active = false;
    };
  }, [needsResolve, payload]);

  const [itemId] = useState(newId);
  const resolvedDraft = useMemo(() => {
    if (!resolvedCoords) return draft;
    return { ...draft, location: { ...draft.location, ...resolvedCoords } };
  }, [draft, resolvedCoords]);
  const initialItem: Item = useMemo(() => ({ id: itemId, ...resolvedDraft }), [itemId, resolvedDraft]);

  const defaultTripId = useMemo(
    () => resolveActiveTrip(trips, activeTripId, today).tripId,
    [trips, activeTripId, today],
  );
  const [pickedTripId, setPickedTripId] = useState<string | null>(null);
  // Fall back to the first trip so a capture still has a home even when every
  // trip is Past (resolveActiveTrip excludes those); the selector lists them all.
  const tripId = pickedTripId ?? defaultTripId ?? trips[0]?.id ?? null;

  useEffect(() => {
    if (tripId) loadTripById(tripId);
  }, [tripId, loadTripById]);

  const summary = tripId ? (trips.find((t) => t.id === tripId) ?? null) : null;

  const tripOptions: TripOption[] = useMemo(
    () => trips.map((t) => ({ id: t.id, label: t.title, past: t.endDate < today })),
    [trips, today],
  );

  function handleSubmit(item: Item, date: string) {
    if (!tripId) return;
    const trip = loadedTrips[tripId];
    if (!trip) return;
    const dayId = dayIdForDate(trip, parseLocalDate(date));
    if (!dayId) return;
    upsertItem(tripId, dayId, item);
    setDisplayedTrip(tripId);
    router.replace('/');
  }

  function handleCancel() {
    router.replace('/');
  }

  // Hold the editor closed until a maps capture's coordinates resolve, so it opens
  // exactly once with its final pin (or address-only) rather than re-seeding mid-edit.
  if (!summary || (needsResolve && resolvedCoords === undefined)) return null;

  return (
    <ItemEditor
      itemId={itemId}
      initialItem={initialItem}
      trip={summary}
      initialDate={defaultCaptureDate(summary, today)}
      tripOptions={tripOptions}
      selectedTripId={tripId ?? undefined}
      onSelectTrip={setPickedTripId}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
    />
  );
}
