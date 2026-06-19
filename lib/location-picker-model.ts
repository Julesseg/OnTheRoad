import { parseLatLng, type Coords } from './coords';
import type { PhotonResult } from './photon';
import type { Item } from './schema';

export type Mode = 'search' | 'pin';

// A selectable row's identity. A tapped landmark is its own kind: there is at
// most one, and choosing any other row discards it (CONTEXT.md#landmark).
export type SelectionKey =
  | { kind: 'poi' }
  | { kind: 'result'; index: number }
  | { kind: 'address' };

export interface PickerState {
  query: string;
  // Live Photon results for free-text search.
  results: PhotonResult[];
  // A pasted coordinate or resolved maps URL synthesizes a single result that
  // stands in for the Photon list; when set, it is the only result shown.
  synthesized: PhotonResult | null;
  // A maps URL is being resolved to coordinates (a transient "Resolving…" row).
  resolving: boolean;
  // The most recently tapped map landmark (POI), shown as a transient row above
  // the search results. At most one; replaced by the next POI tap and cleared
  // when any other row is selected, so a stale landmark never lingers.
  poi: PhotonResult | null;
  selected: SelectionKey | null;
  mode: Mode;
  droppedPin: Coords | null;
  // The search state captured on entering pin mode, restored if the user backs
  // out of pin mode (X) instead of committing a dropped pin.
  saved: SavedSearch | null;
}

interface SavedSearch {
  query: string;
  results: PhotonResult[];
  synthesized: PhotonResult | null;
  resolving: boolean;
  poi: PhotonResult | null;
  selected: SelectionKey | null;
}

export const initialPickerState: PickerState = {
  query: '',
  results: [],
  synthesized: null,
  resolving: false,
  poi: null,
  selected: null,
  mode: 'search',
  droppedPin: null,
  saved: null,
};

export type PickerEvent =
  | { type: 'queryChanged'; text: string }
  | { type: 'resultsLoaded'; results: PhotonResult[] }
  | { type: 'urlResolved'; coords: Coords | null }
  | { type: 'selectRow'; key: SelectionKey }
  | { type: 'enterPinMode' }
  | { type: 'dropPin'; coords: Coords }
  | { type: 'cancelPinMode' }
  | { type: 'poiSelected'; name: string | null; coords: Coords };

const URL_RE = /^https?:\/\//i;

// The effective result list: a synthesized coord/URL result stands in for the
// Photon list when present, otherwise the live search results.
function resultList(state: PickerState): PhotonResult[] {
  return state.synthesized ? [state.synthesized] : state.results;
}

// A pasted coordinate / resolved URL becomes a single result with no address —
// the title is the coordinate pair purely for display; commit stays coords-only.
function synthesizedFromCoords(coords: Coords): PhotonResult {
  return { title: `${coords.lat}, ${coords.lng}`, coords };
}

export function pickerReducer(state: PickerState, event: PickerEvent): PickerState {
  switch (event.type) {
    case 'queryChanged': {
      const text = event.text;
      const coords = parseLatLng(text.trim());
      if (coords) {
        // A pasted coordinate is a single synthesized result, auto-selected. It
        // carries no address, so it commits coords-only.
        const synthesized = synthesizedFromCoords(coords);
        return {
          ...state,
          query: text,
          results: [],
          synthesized,
          resolving: false,
          poi: null,
          selected: { kind: 'result', index: 0 },
        };
      }
      if (URL_RE.test(text.trim())) {
        // A maps URL resolves to coordinates asynchronously (urlResolved); show a
        // transient Resolving row meanwhile with nothing selectable yet.
        return {
          ...state,
          query: text,
          results: [],
          synthesized: null,
          resolving: true,
          poi: null,
          selected: null,
        };
      }
      // Free text: results arrive asynchronously via resultsLoaded; clear any
      // prior selection so the next batch can auto-select its first result.
      return {
        ...state,
        query: text,
        results: [],
        synthesized: null,
        resolving: false,
        poi: null,
        selected: null,
      };
    }
    case 'urlResolved': {
      if (event.coords) {
        return {
          ...state,
          resolving: false,
          synthesized: synthesizedFromCoords(event.coords),
          selected: { kind: 'result', index: 0 },
        };
      }
      // No coordinates behind the URL — drop back to the address last-resort row.
      return { ...state, resolving: false, synthesized: null, selected: null };
    }
    case 'resultsLoaded': {
      // The first result auto-selects on arrival so Select is immediately armed
      // and the camera flies to its pin.
      const selected: SelectionKey | null =
        event.results.length > 0 ? { kind: 'result', index: 0 } : null;
      return { ...state, results: event.results, selected };
    }
    case 'selectRow':
      // Choosing any row other than the tapped landmark discards that landmark
      // (and its map pin), so a stale POI never lingers beside the new choice.
      if (event.key.kind === 'poi') return { ...state, selected: event.key };
      return { ...state, poi: null, selected: event.key };
    case 'enterPinMode': {
      // Idempotent: the sheet drives this both by drag and by button, so the event
      // can arrive when already in pin mode — re-saving would clobber the search.
      if (state.mode === 'pin') return state;
      const { query, results, synthesized, resolving, poi, selected } = state;
      return {
        ...state,
        mode: 'pin',
        droppedPin: null,
        saved: { query, results, synthesized, resolving, poi, selected },
      };
    }
    case 'dropPin':
      return { ...state, droppedPin: event.coords };
    case 'cancelPinMode': {
      // Idempotent for the same reason as enterPinMode.
      if (state.mode === 'search') return state;
      if (!state.saved) return { ...state, mode: 'search', droppedPin: null };
      return { ...state, ...state.saved, mode: 'search', droppedPin: null, saved: null };
    }
    case 'poiSelected': {
      // In pin mode a tapped POI behaves like any map tap — it drops the pin
      // there (the native POI tap is the only signal we get, since onMapClick
      // doesn't fire over a POI).
      if (state.mode === 'pin') return { ...state, droppedPin: event.coords };
      // In search mode the POI takes the transient `poi` slot above the results
      // and is auto-selected, leaving the existing search list untouched beneath
      // it. It replaces any previously tapped POI (only one at a time). A nameless
      // POI keeps only its point (its coord pair stands in as a title).
      const poi: PhotonResult = event.name
        ? { title: event.name, coords: event.coords }
        : synthesizedFromCoords(event.coords);
      return { ...state, poi, selected: { kind: 'poi' } };
    }
  }
}

export type Row =
  | { kind: 'resolving' }
  | { kind: 'poi'; result: PhotonResult }
  | { kind: 'result'; index: number; result: PhotonResult }
  | { kind: 'address'; text: string };

export function rows(state: PickerState): Row[] {
  const out: Row[] = [];
  if (state.resolving) out.push({ kind: 'resolving' });
  // The tapped landmark sits at the top, above the search results it doesn't
  // disturb.
  if (state.poi) out.push({ kind: 'poi', result: state.poi });
  resultList(state).forEach((result, index) => out.push({ kind: 'result', index, result }));
  // The plain-address last resort is only for ordinary free text. A pasted
  // coordinate or resolved URL already has a point (so address-only would discard
  // it), and a URL still resolving has one coming — suppress the row in both cases.
  // It returns if the URL fails to resolve (synthesized stays null, resolving clears).
  const text = state.query.trim();
  if (text && !state.synthesized && !state.resolving) out.push({ kind: 'address', text });
  return out;
}

// Accent result pins drawn over the trip's greyed pins. Cleared in pin mode so
// only the hand-dropped pin shows. A tapped landmark is the focus, so while one
// is active only its pin shows — the search-result candidate pins step aside so
// no stale pin lingers beside it.
export function resultPins(state: PickerState): Coords[] {
  if (state.mode === 'pin') return [];
  if (state.poi) return [state.poi.coords];
  return resultList(state).map((r) => r.coords);
}

// Where the camera should fly for the current selection. A selected result (or
// dropped pin) zooms to its point; the address row is the lone zoom-out, framing
// the greyed trip; null leaves the camera where it is.
export type CameraTarget = { kind: 'point'; coords: Coords } | { kind: 'frameTrip' };

export function cameraTarget(state: PickerState): CameraTarget | null {
  if (state.mode === 'pin') {
    return state.droppedPin ? { kind: 'point', coords: state.droppedPin } : null;
  }
  const selected = state.selected;
  if (selected?.kind === 'poi') {
    return state.poi ? { kind: 'point', coords: state.poi.coords } : null;
  }
  if (selected?.kind === 'result') {
    const result = resultList(state)[selected.index];
    return result ? { kind: 'point', coords: result.coords } : null;
  }
  if (selected?.kind === 'address') return { kind: 'frameTrip' };
  return null;
}

export function committedLocation(state: PickerState): Item['location'] | null {
  if (state.mode === 'pin') {
    return state.droppedPin
      ? { lat: state.droppedPin.lat, lng: state.droppedPin.lng }
      : null;
  }
  const selected = state.selected;
  if (selected?.kind === 'poi') {
    const poi = state.poi;
    return poi ? { address: poi.title, lat: poi.coords.lat, lng: poi.coords.lng } : null;
  }
  if (selected?.kind === 'result') {
    const result = resultList(state)[selected.index];
    if (!result) return null;
    // A synthesized coord/URL result has no address — commit coords-only.
    if (state.synthesized) {
      return { lat: result.coords.lat, lng: result.coords.lng };
    }
    return { address: result.title, lat: result.coords.lat, lng: result.coords.lng };
  }
  if (selected?.kind === 'address') {
    return { address: state.query.trim() };
  }
  return null;
}
