import { parseLatLng, type Coords } from './coords';
import type { PhotonResult } from './photon';
import type { Item } from './schema';

// A selectable row's identity. The map-tapped pin and a tapped landmark (POI) are
// each their own transient kind: there is at most one of each, and choosing any
// other row discards it, so a stale pin/POI never lingers behind a different
// choice. Dropping a pin and tapping a landmark are peers — each clears the other.
export type SelectionKey =
  | { kind: 'pin' }
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
  // when any other row is selected (or a pin is dropped), so a stale landmark
  // never lingers.
  poi: PhotonResult | null;
  selected: SelectionKey | null;
  // A coordinate placed by tapping empty map. It shows as the leading row and is
  // auto-selected; it "disappears" the moment another row is selected (or the
  // query changes), so it never lingers behind a different choice. The map is
  // always tappable — there is no pin mode.
  pin: Coords | null;
}

export const initialPickerState: PickerState = {
  query: '',
  results: [],
  synthesized: null,
  resolving: false,
  poi: null,
  selected: null,
  pin: null,
};

export type PickerEvent =
  | { type: 'queryChanged'; text: string }
  | { type: 'resultsLoaded'; results: PhotonResult[] }
  | { type: 'urlResolved'; coords: Coords | null }
  | { type: 'selectRow'; key: SelectionKey }
  | { type: 'mapTapped'; coords: Coords }
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
          poi: null,
          selected: null,
          pin: null,
        };
      }
      // Free text: results arrive asynchronously via resultsLoaded; clear any
      // prior selection so the next batch can auto-select its first result. A new
      // search supersedes a map-tapped pin or a tapped landmark, so drop both.
      return {
        ...state,
        query: text,
        results: [],
        synthesized: null,
        resolving: false,
        poi: null,
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
      // Selecting the map-tapped pin keeps it (and discards any tapped landmark);
      // selecting the landmark keeps it (and discards the pin); selecting any other
      // row discards both, so a stale pin/POI never sits behind a different choice.
      const pin = event.key.kind === 'pin' ? state.pin : null;
      const poi = event.key.kind === 'poi' ? state.poi : null;
      return { ...state, selected: event.key, pin, poi };
    }
    case 'mapTapped':
      // A map tap places (or moves) the pin and selects it; it leads the result
      // list over any live results, and supersedes any tapped landmark.
      return { ...state, pin: event.coords, poi: null, selected: { kind: 'pin' } };
    case 'poiSelected': {
      // Tapping a landmark takes the transient `poi` slot above the results and is
      // auto-selected, leaving the existing search list untouched beneath it. It
      // replaces any previously tapped POI (only one at a time) and supersedes a
      // hand-dropped pin. A nameless POI keeps only its point (its coord pair
      // stands in as a title).
      const poi: PhotonResult = event.name
        ? { title: event.name, coords: event.coords }
        : synthesizedFromCoords(event.coords);
      return { ...state, poi, pin: null, selected: { kind: 'poi' } };
    }
  }
}

export type Row =
  | { kind: 'pin'; coords: Coords }
  | { kind: 'resolving' }
  | { kind: 'poi'; result: PhotonResult }
  | { kind: 'result'; index: number; result: PhotonResult }
  | { kind: 'address'; text: string };

// A map-tapped pin's display label — its coordinate pair truncated to 3 decimals
// for legibility (the committed location keeps full precision; commit stays
// coords-only, with no address).
export function pinLabel(coords: Coords): string {
  return `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`;
}

export function rows(state: PickerState): Row[] {
  const out: Row[] = [];
  // A map-tapped pin leads the list and disappears when another row is selected.
  if (state.pin) out.push({ kind: 'pin', coords: state.pin });
  if (state.resolving) out.push({ kind: 'resolving' });
  // The tapped landmark sits at the top of the results it doesn't disturb (it and
  // the pin are mutually exclusive, so at most one leads the list).
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

// The display label of the current selection — surfaced as the sheet title when
// the sheet shrinks to its peek detent and the row list is out of view.
export function selectionLabel(state: PickerState): string | null {
  const selected = state.selected;
  if (!selected) return null;
  if (selected.kind === 'pin') return state.pin ? pinLabel(state.pin) : null;
  if (selected.kind === 'poi') return state.poi?.title ?? null;
  if (selected.kind === 'result') return resultList(state)[selected.index]?.title ?? null;
  if (selected.kind === 'address') return state.query.trim() || null;
  return null;
}

// Accent result pins drawn over the trip's greyed pins. A hand-dropped pin stands
// alone (its pin is drawn separately, so the candidate pins clear); a tapped
// landmark is the focus, so while one is active only its pin shows.
export function resultPins(state: PickerState): Coords[] {
  if (state.pin) return [];
  if (state.poi) return [state.poi.coords];
  return resultList(state).map((r) => r.coords);
}

// Where the camera should fly for the current selection. A selected result (or
// dropped pin / tapped landmark) zooms to its point; the address row is the lone
// zoom-out, framing the greyed trip; null leaves the camera where it is.
export type CameraTarget = { kind: 'point'; coords: Coords } | { kind: 'frameTrip' };

export function cameraTarget(state: PickerState): CameraTarget | null {
  const selected = state.selected;
  if (selected?.kind === 'pin') {
    return state.pin ? { kind: 'point', coords: state.pin } : null;
  }
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
  const selected = state.selected;
  if (selected?.kind === 'pin') {
    // A map-tapped pin carries no address — commit coords-only.
    return state.pin ? { lat: state.pin.lat, lng: state.pin.lng } : null;
  }
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
