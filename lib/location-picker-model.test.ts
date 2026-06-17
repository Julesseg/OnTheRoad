import { describe, it, expect } from 'vitest';
import {
  initialPickerState,
  pickerReducer,
  rows,
  committedLocation,
  cameraTarget,
  resultPins,
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

  it('pin mode clears result pins; dropping a pin arms Select and commits coords-only', () => {
    const loaded = pickerReducer(
      pickerReducer(initialPickerState, { type: 'queryChanged', text: 'seattle' }),
      { type: 'resultsLoaded', results: [PIKE] },
    );

    const pinMode = pickerReducer(loaded, { type: 'enterPinMode' });
    // Result pins are cleared while dropping by hand; nothing to commit until a drop.
    expect(resultPins(pinMode)).toEqual([]);
    expect(committedLocation(pinMode)).toBeNull();

    const dropped = pickerReducer(pinMode, { type: 'dropPin', coords: { lat: 1, lng: 2 } });
    expect(committedLocation(dropped)).toEqual({ lat: 1, lng: 2 });
  });

  it('cancelling pin mode discards the dropped pin and restores the prior search', () => {
    const loaded = pickerReducer(
      pickerReducer(initialPickerState, { type: 'queryChanged', text: 'seattle' }),
      { type: 'resultsLoaded', results: [PIKE] },
    );
    const dropped = pickerReducer(pickerReducer(loaded, { type: 'enterPinMode' }), {
      type: 'dropPin',
      coords: { lat: 1, lng: 2 },
    });

    const back = pickerReducer(dropped, { type: 'cancelPinMode' });
    expect(back.mode).toBe('search');
    expect(back.droppedPin).toBeNull();
    // The prior query, results, and selection are exactly as they were.
    expect(rows(back)).toEqual(rows(loaded));
    expect(back.selected).toEqual(loaded.selected);
    expect(committedLocation(back)).toEqual(committedLocation(loaded));
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
