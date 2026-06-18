import { create } from 'zustand';

import type { DateEditMode } from './trip-days';

/** The span + mode a finished date edit stages back onto the Edit Trip screen. */
export interface StagedDates {
  startDate: string;
  endDate: string;
  mode: DateEditMode;
}

// Editing an existing trip's dates is a separate screen (Shift / Adjust choice →
// the matching picker(s)) reached from Edit Trip. Route params can't carry a
// callback, and the result must outlive the date screen's mount, so the Edit
// screen records its callback here right before pushing the date screen;
// confirming hands the staged span + mode back to it. Mirrors the Location
// Picker's transient store.
interface DateEditStore {
  onConfirm: ((staged: StagedDates) => void) | null;
  begin: (onConfirm: (staged: StagedDates) => void) => void;
  confirm: (staged: StagedDates) => void;
  end: () => void;
}

export const useDateEditStore = create<DateEditStore>((set, get) => ({
  onConfirm: null,
  begin: (onConfirm) => set({ onConfirm }),
  confirm: (staged) => get().onConfirm?.(staged),
  end: () => set({ onConfirm: null }),
}));

/** The Edit screen begins a date edit right before pushing the date screen,
 * handing in the callback that stages the confirmed span + mode. */
export function beginDateEdit(onConfirm: (staged: StagedDates) => void): void {
  useDateEditStore.getState().begin(onConfirm);
}
