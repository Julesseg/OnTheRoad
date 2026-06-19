import { parseLatLng, type Coords } from './coords';
import type { PhotonResult } from './photon';
import type { Item } from './schema';

// A selectable row's identity. Selection is sticky and there is no deselect, so
// this is only ever cleared by the X (cancel) — never by re-tapping a row.
export type SelectionKey =
  | { kind: 'result'; index: number }
  | { kind: 'address' }
  | { kind: 'pin' };

export interface PickerState {
  query: string;
  // Live Photon results for free-text search.
  results: PhotonResult[];
  // A pasted coordinate or resolved maps URL synthesizes a single result that
  // stands in for the Photon list; when set, it is the only result shown.
  synthesized: PhotonResult | null;
  // A maps URL is being resolved to coordinates (a transient "Resolving…" row).
  resolving: boolean;
  selected: SelectionKey | null;
  // A coordinate placed by tapping the map. It shows as the first row and is
  // auto-selected; it "disappears" the moment another row is selected (or the
  // query changes), so it never lingers behind a different choice.
  pin: Coords | null;
}

export const initialPickerState: PickerState = {
  query: '',
  results: [],
  synthesized: null,
  resolving: false,
  selected: null,
  pin: null,
};

export type PickerEvent =
  | { type: 'queryChanged'; text: string }
  | { type: 'resultsLoaded'; results: PhotonResult[] }
  | { type: 'urlResolved'; coords: Coords | null }
  | { type: 'selectRow'; key: SelectionKey }
  | { type: 'mapTapped'; coords: Coords };

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
          selected: { kind: 'result', index: 0 },
          pin: null,
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
          selected: null,
          pin: null,
        };
      }
      // Free text: results arrive asynchronously via resultsLoaded; clear any
      // prior selection so the next batch can auto-select its first result. A new
      // search supersedes any map-tapped pin, so drop it.
      return {
        ...state,
        query: text,
        results: [],
        synthesized: null,
        resolving: false,
        selected: null,
        pin: null,
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
    case 'selectRow': {
      // Selecting any row other than the map-tapped pin makes that pin disappear,
      // so a stale coordinate never sits behind a different choice.
      const pin = event.key.kind === 'pin' ? state.pin : null;
      return { ...state, selected: event.key, pin };
    }
    case 'mapTapped':
      // A map tap places (or moves) the pin and selects it; it shows as the first
      // row over any live search results.
      return { ...state, pin: event.coords, selected: { kind: 'pin' } };
  }
}

export type Row =
  | { kind: 'pin'; coords: Coords }
  | { kind: 'resolving' }
  | { kind: 'result'; index: number; result: PhotonResult }
  | { kind: 'address'; text: string };

// A map-tapped pin's display label — its coordinate pair, the same form a pasted
// coordinate takes (no address; commit stays coords-only).
export function pinLabel(coords: Coords): string {
  return `${coords.lat}, ${coords.lng}`;
}

export function rows(state: PickerState): Row[] {
  const out: Row[] = [];
  // A map-tapped pin leads the list and disappears when another row is selected.
  if (state.pin) out.push({ kind: 'pin', coords: state.pin });
  if (state.resolving) out.push({ kind: 'resolving' });
  resultList(state).forEach((result, index) => out.push({ kind: 'result', index, result }));
  // The plain-address last resort is only for ordinary free text. A pasted
  // coordinate or resolved URL already has a point (so address-only would discard
  // it), and a URL still resolving has one coming — suppress the row in both cases.
  // It returns if the URL fails to resolve (synthesized stays null, resolving clears).
  const text = state.query.trim();
  if (text && !state.synthesized && !state.resolving) out.push({ kind: 'address', text });
  return out;
}

// The display label of the current selection — surfaced as the sheet title when
// the sheet shrinks to its peek detent and the row list is out of view.
export function selectionLabel(state: PickerState): string | null {
  const selected = state.selected;
  if (!selected) return null;
  if (selected.kind === 'pin') return state.pin ? pinLabel(state.pin) : null;
  if (selected.kind === 'result') return resultList(state)[selected.index]?.title ?? null;
  if (selected.kind === 'address') return state.query.trim() || null;
  return null;
}

// Accent result pins drawn over the trip's greyed pins. A hand-dropped pin stands
// alone: while one is placed the search candidates' pins clear, so the last
// selected result's pin disappears and only the dropped pin shows.
export function resultPins(state: PickerState): Coords[] {
  if (state.pin) return [];
  return resultList(state).map((r) => r.coords);
}

// Where the camera should fly for the current selection. A selected result (or
// dropped pin) zooms to its point; the address row is the lone zoom-out, framing
// the greyed trip; null leaves the camera where it is.
export type CameraTarget = { kind: 'point'; coords: Coords } | { kind: 'frameTrip' };

export function cameraTarget(state: PickerState): CameraTarget | null {
  const selected = state.selected;
  if (selected?.kind === 'pin') {
    return state.pin ? { kind: 'point', coords: state.pin } : null;
  }
  if (selected?.kind === 'result') {
    const result = resultList(state)[selected.index];
    return result ? { kind: 'point', coords: result.coords } : null;
  }
  if (selected?.kind === 'address') return { kind: 'frameTrip' };
  return null;
}

export function committedLocation(state: PickerState): Item['location'] | null {
  const selected = state.selected;
  if (selected?.kind === 'pin') {
    // A map-tapped pin carries no address — commit coords-only.
    return state.pin ? { lat: state.pin.lat, lng: state.pin.lng } : null;
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
