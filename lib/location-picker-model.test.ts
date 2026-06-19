import { describe, it, expect } from 'vitest';
import {
  initialPickerState,
  pickerReducer,
  rows,
  committedLocation,
  cameraTarget,
  resultPins,
  selectionLabel,
} from '@/lib/location-picker-model';
import type { PhotonResult } from '@/lib/photon';

const PIKE: PhotonResult = {
  title: 'Pike Place Market',
  coords: { lat: 47.6097, lng: -122.3422 },
  address: 'Seattle, US',
};

const SPACE_NEEDLE: PhotonResult = {
  title: 'Space Needle',
  coords: { lat: 47.6205, lng: -122.3493 },
  address: 'Seattle, US',
};

describe('LocationPicker model', () => {
  it('typing free text offers a plain-address last-resort row that commits { address }', () => {
    const s = pickerReducer(initialPickerState, { type: 'queryChanged', text: 'Paris, France' });

    // The address fallback row is present and labelled with the typed text.
    expect(rows(s)).toContainEqual({ kind: 'address', text: 'Paris, France' });
    // Nothing is selected yet, so there is nothing to commit.
    expect(committedLocation(s)).toBeNull();

    const selected = pickerReducer(s, { type: 'selectRow', key: { kind: 'address' } });
    expect(committedLocation(selected)).toEqual({ address: 'Paris, France' });
  });

  it('loading Photon results lists them, auto-selects the first, and commits { address, lat, lng }', () => {
    const queried = pickerReducer(initialPickerState, { type: 'queryChanged', text: 'pike' });
    const loaded = pickerReducer(queried, { type: 'resultsLoaded', results: [PIKE] });

    // Result row above the standing address fallback row.
    expect(rows(loaded)).toEqual([
      { kind: 'result', index: 0, result: PIKE },
      { kind: 'address', text: 'pike' },
    ]);

    // The first result auto-selects on arrival, so Select is immediately armed.
    expect(loaded.selected).toEqual({ kind: 'result', index: 0 });
    expect(committedLocation(loaded)).toEqual({
      address: 'Pike Place Market',
      lat: 47.6097,
      lng: -122.3422,
    });
  });

  it('pasting lat,lng synthesizes a single auto-selected result that commits coords-only', () => {
    const s = pickerReducer(initialPickerState, { type: 'queryChanged', text: '48.85, 2.35' });

    // Exactly one result row (the synthesized pin), plus the address fallback.
    expect(rows(s).filter((r) => r.kind === 'result')).toHaveLength(1);
    expect(s.selected).toEqual({ kind: 'result', index: 0 });
    // A coordinate carries no address label.
    expect(committedLocation(s)).toEqual({ lat: 48.85, lng: 2.35 });
  });

  it('suppresses the plain-address row while a coord/URL pin stands in', () => {
    // A pasted coordinate already has a point; address-only would discard it.
    const coord = pickerReducer(initialPickerState, { type: 'queryChanged', text: '48.85, 2.35' });
    expect(rows(coord).some((r) => r.kind === 'address')).toBe(false);

    // While a URL is resolving there is a point coming; no address fallback yet.
    const resolving = pickerReducer(initialPickerState, {
      type: 'queryChanged',
      text: 'https://maps.app.goo.gl/abc',
    });
    expect(rows(resolving).some((r) => r.kind === 'address')).toBe(false);

    // But once a URL fails to resolve, the address row returns as the escape hatch.
    const failed = pickerReducer(resolving, { type: 'urlResolved', coords: null });
    expect(rows(failed)).toContainEqual({ kind: 'address', text: 'https://maps.app.goo.gl/abc' });
  });

  it('a maps URL shows a transient Resolving row, then resolves to an auto-selected coords-only pin', () => {
    const pasted = pickerReducer(initialPickerState, {
      type: 'queryChanged',
      text: 'https://maps.app.goo.gl/abc',
    });
    // While resolving there is nothing to select and a Resolving row is shown.
    expect(rows(pasted).some((r) => r.kind === 'resolving')).toBe(true);
    expect(committedLocation(pasted)).toBeNull();

    const resolved = pickerReducer(pasted, {
      type: 'urlResolved',
      coords: { lat: 47.61, lng: -122.34 },
    });
    expect(resolved.selected).toEqual({ kind: 'result', index: 0 });
    expect(committedLocation(resolved)).toEqual({ lat: 47.61, lng: -122.34 });
  });

  it('a maps URL that fails to resolve falls back to the address row', () => {
    const pasted = pickerReducer(initialPickerState, {
      type: 'queryChanged',
      text: 'https://example.com/x',
    });
    const failed = pickerReducer(pasted, { type: 'urlResolved', coords: null });

    expect(failed.resolving).toBe(false);
    expect(rows(failed).some((r) => r.kind === 'resolving')).toBe(false);
    // Only the standing address fallback remains; nothing auto-selected.
    expect(failed.selected).toBeNull();
    expect(rows(failed)).toContainEqual({ kind: 'address', text: 'https://example.com/x' });
  });

  it('selection drives the camera pin-to-pin, and the address row frames the trip', () => {
    const loaded = pickerReducer(
      pickerReducer(initialPickerState, { type: 'queryChanged', text: 'seattle' }),
      { type: 'resultsLoaded', results: [PIKE, SPACE_NEEDLE] },
    );

    // Every result is an accent pin on the map; the camera flies to the selected one.
    expect(resultPins(loaded)).toEqual([PIKE.coords, SPACE_NEEDLE.coords]);
    expect(cameraTarget(loaded)).toEqual({ kind: 'point', coords: PIKE.coords });

    const switched = pickerReducer(loaded, {
      type: 'selectRow',
      key: { kind: 'result', index: 1 },
    });
    expect(cameraTarget(switched)).toEqual({ kind: 'point', coords: SPACE_NEEDLE.coords });

    // Selecting the plain-address row is the lone zoom-out: it frames the greyed trip.
    const address = pickerReducer(loaded, { type: 'selectRow', key: { kind: 'address' } });
    expect(cameraTarget(address)).toEqual({ kind: 'frameTrip' });
  });

  it('tapping the map leads the list with an auto-selected coords-only pin', () => {
    const loaded = pickerReducer(
      pickerReducer(initialPickerState, { type: 'queryChanged', text: 'seattle' }),
      { type: 'resultsLoaded', results: [PIKE, SPACE_NEEDLE] },
    );

    const tapped = pickerReducer(loaded, { type: 'mapTapped', coords: { lat: 1, lng: 2 } });

    // The pin is the first row, above the search results, and is auto-selected.
    expect(rows(tapped)).toEqual([
      { kind: 'pin', coords: { lat: 1, lng: 2 } },
      { kind: 'result', index: 0, result: PIKE },
      { kind: 'result', index: 1, result: SPACE_NEEDLE },
      { kind: 'address', text: 'seattle' },
    ]);
    expect(tapped.selected).toEqual({ kind: 'pin' });
    // Both the camera and the committed location follow the pin, coords-only.
    expect(cameraTarget(tapped)).toEqual({ kind: 'point', coords: { lat: 1, lng: 2 } });
    expect(committedLocation(tapped)).toEqual({ lat: 1, lng: 2 });
    // The dropped pin stands alone: the search candidates' map pins clear so only
    // it shows. Selecting another result brings the result pins back.
    expect(resultPins(tapped)).toEqual([]);
    const picked = pickerReducer(tapped, { type: 'selectRow', key: { kind: 'result', index: 1 } });
    expect(resultPins(picked)).toEqual([PIKE.coords, SPACE_NEEDLE.coords]);
  });

  it('selecting another result makes the map-tapped pin disappear', () => {
    const loaded = pickerReducer(
      pickerReducer(initialPickerState, { type: 'queryChanged', text: 'seattle' }),
      { type: 'resultsLoaded', results: [PIKE] },
    );
    const tapped = pickerReducer(loaded, { type: 'mapTapped', coords: { lat: 1, lng: 2 } });

    const picked = pickerReducer(tapped, { type: 'selectRow', key: { kind: 'result', index: 0 } });
    expect(picked.pin).toBeNull();
    expect(rows(picked).some((r) => r.kind === 'pin')).toBe(false);
    expect(committedLocation(picked)).toEqual({
      address: 'Pike Place Market',
      lat: 47.6097,
      lng: -122.3422,
    });
  });

  it('moving the pin re-taps without clearing it; a new query drops it', () => {
    const loaded = pickerReducer(
      pickerReducer(initialPickerState, { type: 'queryChanged', text: 'seattle' }),
      { type: 'resultsLoaded', results: [PIKE] },
    );
    const tapped = pickerReducer(loaded, { type: 'mapTapped', coords: { lat: 1, lng: 2 } });

    // Re-tapping selects the pin again at the new coordinates.
    const moved = pickerReducer(tapped, { type: 'mapTapped', coords: { lat: 3, lng: 4 } });
    expect(moved.pin).toEqual({ lat: 3, lng: 4 });
    expect(moved.selected).toEqual({ kind: 'pin' });

    // Typing a fresh search supersedes the pin.
    const retyped = pickerReducer(moved, { type: 'queryChanged', text: 'paris' });
    expect(retyped.pin).toBeNull();
  });

  it('selectionLabel names the current selection for the peek-detent title', () => {
    const loaded = pickerReducer(
      pickerReducer(initialPickerState, { type: 'queryChanged', text: 'seattle' }),
      { type: 'resultsLoaded', results: [PIKE] },
    );
    expect(selectionLabel(loaded)).toBe('Pike Place Market');

    const tapped = pickerReducer(loaded, { type: 'mapTapped', coords: { lat: 1, lng: 2 } });
    // Coordinates display truncated to 3 decimals.
    expect(selectionLabel(tapped)).toBe('1.000, 2.000');

    const address = pickerReducer(loaded, { type: 'selectRow', key: { kind: 'address' } });
    expect(selectionLabel(address)).toBe('seattle');
  });

  const GUM_WALL = { name: 'Gum Wall', coords: { lat: 47.6086, lng: -122.3401 } } as const;
  const GUM_WALL_RESULT = { title: 'Gum Wall', coords: GUM_WALL.coords };

  it('tapping a named POI adds it as an auto-selected row above the existing list', () => {
    // Mid-search, the user taps a landmark on the map instead.
    const searching = pickerReducer(
      pickerReducer(initialPickerState, { type: 'queryChanged', text: 'seattle' }),
      { type: 'resultsLoaded', results: [PIKE, SPACE_NEEDLE] },
    );

    const tapped = pickerReducer(searching, { type: 'poiSelected', ...GUM_WALL });

    // The POI sits on top as its own row; the search results keep their indices.
    expect(rows(tapped)).toEqual([
      { kind: 'poi', result: GUM_WALL_RESULT },
      { kind: 'result', index: 0, result: PIKE },
      { kind: 'result', index: 1, result: SPACE_NEEDLE },
      // The query is untouched, so its plain-address fallback row still stands.
      { kind: 'address', text: 'seattle' },
    ]);
    expect(tapped.selected).toEqual({ kind: 'poi' });
    expect(cameraTarget(tapped)).toEqual({ kind: 'point', coords: GUM_WALL.coords });
    // While the landmark is active only its pin shows — the candidate pins step aside.
    expect(resultPins(tapped)).toEqual([GUM_WALL.coords]);
    // A named POI commits with its name as the address.
    expect(committedLocation(tapped)).toEqual({
      address: 'Gum Wall',
      lat: 47.6086,
      lng: -122.3401,
    });
  });

  it('switching to another POI replaces the first — only one landmark at a time', () => {
    const first = pickerReducer(initialPickerState, { type: 'poiSelected', ...GUM_WALL });
    const second = pickerReducer(first, {
      type: 'poiSelected',
      name: 'Space Needle',
      coords: SPACE_NEEDLE.coords,
    });

    expect(rows(second)).toEqual([
      { kind: 'poi', result: { title: 'Space Needle', coords: SPACE_NEEDLE.coords } },
    ]);
    // Only the current landmark's pin remains.
    expect(resultPins(second)).toEqual([SPACE_NEEDLE.coords]);
  });

  it('selecting a search result discards the tapped POI and its pin', () => {
    const searched = pickerReducer(
      pickerReducer(initialPickerState, { type: 'queryChanged', text: 'seattle' }),
      { type: 'resultsLoaded', results: [PIKE, SPACE_NEEDLE] },
    );
    const tapped = pickerReducer(searched, { type: 'poiSelected', ...GUM_WALL });

    const picked = pickerReducer(tapped, { type: 'selectRow', key: { kind: 'result', index: 1 } });

    // The POI row is gone; only the search results (and address fallback) remain.
    expect(picked.poi).toBeNull();
    expect(rows(picked).some((r) => r.kind === 'poi')).toBe(false);
    expect(resultPins(picked)).toEqual([PIKE.coords, SPACE_NEEDLE.coords]);
    expect(committedLocation(picked)).toEqual({
      address: 'Space Needle',
      lat: SPACE_NEEDLE.coords.lat,
      lng: SPACE_NEEDLE.coords.lng,
    });
  });

  it('typing a new query clears a tapped POI', () => {
    const tapped = pickerReducer(initialPickerState, { type: 'poiSelected', ...GUM_WALL });
    const typed = pickerReducer(tapped, { type: 'queryChanged', text: 'paris' });
    expect(typed.poi).toBeNull();
  });

  it('tapping a POI keeps its coordinates and auto-selects it', () => {
    const tapped = pickerReducer(initialPickerState, {
      type: 'poiSelected',
      name: null,
      coords: { lat: 1, lng: 2 },
    });

    expect(tapped.selected).toEqual({ kind: 'poi' });
    expect(committedLocation(tapped)).toEqual({ address: '1, 2', lat: 1, lng: 2 });
  });

  it('the map-tapped pin and a tapped landmark are peers — each clears the other', () => {
    // A landmark tap supersedes a hand-dropped pin.
    const pinned = pickerReducer(initialPickerState, { type: 'mapTapped', coords: { lat: 1, lng: 2 } });
    const thenPoi = pickerReducer(pinned, { type: 'poiSelected', ...GUM_WALL });
    expect(thenPoi.pin).toBeNull();
    expect(thenPoi.poi).toEqual(GUM_WALL_RESULT);
    expect(thenPoi.selected).toEqual({ kind: 'poi' });

    // And a map tap supersedes a tapped landmark.
    const thenPin = pickerReducer(thenPoi, { type: 'mapTapped', coords: { lat: 3, lng: 4 } });
    expect(thenPin.poi).toBeNull();
    expect(thenPin.pin).toEqual({ lat: 3, lng: 4 });
    expect(thenPin.selected).toEqual({ kind: 'pin' });
  });

  it('clearing the query empties the rows and the selection', () => {
    const loaded = pickerReducer(
      pickerReducer(initialPickerState, { type: 'queryChanged', text: 'pike' }),
      { type: 'resultsLoaded', results: [PIKE] },
    );

    const cleared = pickerReducer(loaded, { type: 'queryChanged', text: '' });
    expect(rows(cleared)).toEqual([]);
    expect(cleared.selected).toBeNull();
    expect(committedLocation(cleared)).toBeNull();
  });
});
