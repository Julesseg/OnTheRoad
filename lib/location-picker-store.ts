import { create } from 'zustand';

import {
  initialPickerState,
  pickerReducer,
  committedLocation,
  type PickerState,
  type PickerEvent,
} from './location-picker-model';
import type { Item } from './schema';

// The Location Picker spans two screens — a full-screen map and a search sheet
// over it — that share one transient state. Route params can't carry it (or the
// editor's onConfirm callback), and it must outlive each screen's mount, so it
// lives here. The editor begins a pick right before pushing the picker; the map
// and sheet both read and dispatch against this store; confirming hands the
// committed location back to the editor's callback.
interface PickerStore {
  state: PickerState;
  onConfirm: ((location: Item['location']) => void) | null;
  // Opens blank every time: resets the state and records the editor's callback.
  begin: (onConfirm: (location: Item['location']) => void) => void;
  dispatch: (event: PickerEvent) => void;
  // Returns the current selection to the editor, when something is selected.
  confirm: () => void;
  end: () => void;
}

export const usePickerStore = create<PickerStore>((set, get) => ({
  state: initialPickerState,
  onConfirm: null,
  begin: (onConfirm) => set({ state: initialPickerState, onConfirm }),
  dispatch: (event) => set((s) => ({ state: pickerReducer(s.state, event) })),
  confirm: () => {
    const { state, onConfirm } = get();
    const location = committedLocation(state);
    if (location) onConfirm?.(location);
  },
  end: () => set({ state: initialPickerState, onConfirm: null }),
}));

// The item editor begins a pick right before pushing the picker route, handing in
// the callback that receives the confirmed location. Opens blank every time.
export function beginLocationPick(onConfirm: (location: Item['location']) => void): void {
  usePickerStore.getState().begin(onConfirm);
}
