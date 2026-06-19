import type { ChecklistItem } from './schema';

/**
 * Zero-width space kept as the first character of every entry's *native* text
 * field. SwiftUI's `TextField` reports no key events, so a backspace pressed at
 * the very start of a row produces no `onTextChange` (the visible text is
 * already what it was). The sentinel gives that keystroke something to delete:
 * when a field's text comes back without its leading sentinel we know the caret
 * was at offset 0 and the user pressed backspace — the cue to merge the row into
 * the one above, paragraph-style. The sentinel lives only in the native field;
 * the `label` we keep in React state (and save) is always sentinel-free.
 */
export const ENTRY_SENTINEL = '\u200B';

/** A row to focus after an edit, with the caret offset within its `label`
 * (sentinel-free coordinates; the editor adds the sentinel offset when it talks
 * to the native field). */
export type ChecklistFocus = { id: string; cursor: number };

/** Insert a fresh blank entry directly below `id` (Return on a row). The current
 * row keeps its text; the new row is the one to focus. Pure. Appends to the end
 * when `id` isn't found. */
export function insertEntryAfter(
  checklist: ChecklistItem[],
  id: string,
  makeId: () => string,
): { checklist: ChecklistItem[]; focusId: string } {
  const created: ChecklistItem = { id: makeId(), label: '', checked: false };
  const i = checklist.findIndex((e) => e.id === id);
  if (i === -1) return { checklist: [...checklist, created], focusId: created.id };
  const next = [...checklist.slice(0, i + 1), created, ...checklist.slice(i + 1)];
  return { checklist: next, focusId: created.id };
}

/** Remove entry `id` (Backspace on an empty row). `focus` points at the row
 * above with the caret at its end, or is `null` when `id` was the first row
 * (nothing above to land on). Pure. */
export function removeEntry(
  checklist: ChecklistItem[],
  id: string,
): { checklist: ChecklistItem[]; focus: ChecklistFocus | null } {
  const i = checklist.findIndex((e) => e.id === id);
  if (i === -1) return { checklist, focus: null };
  const next = [...checklist.slice(0, i), ...checklist.slice(i + 1)];
  const focus = i > 0 ? { id: checklist[i - 1].id, cursor: checklist[i - 1].label.length } : null;
  return { checklist: next, focus };
}

/** Progress label for a checklist, e.g. "2/5" — checked count over total. */
export function checklistProgress(checklist: ChecklistItem[]): string {
  const done = checklist.filter((e) => e.checked).length;
  return `${done}/${checklist.length}`;
}

/** Reorder entries per SwiftUI's `onMove` semantics (same contract as
 * `reorderItemInDay`): `destination` indexes the original array. Pure.
 * Returns the input list unchanged when the move is a no-op. */
export function moveEntries(
  checklist: ChecklistItem[],
  sourceIndices: number[],
  destination: number,
): ChecklistItem[] {
  const sources = [...new Set(sourceIndices)]
    .filter((i) => i >= 0 && i < checklist.length)
    .sort((a, b) => a - b);
  const moved = sources.map((i) => checklist[i]);
  const remaining = checklist.filter((_, i) => !sources.includes(i));
  // SwiftUI's `destination` indexes the original array; shift it left by the
  // number of moved entries that sat before it so the drop lands where expected.
  const insertAt = destination - sources.filter((i) => i < destination).length;
  const next = [...remaining.slice(0, insertAt), ...moved, ...remaining.slice(insertAt)];
  if (next.every((e, i) => e === checklist[i])) return checklist;
  return next;
}

/** Trim entry labels and drop the entries left empty — run on editor save so
 * half-typed rows never reach storage. Pure. */
export function sanitizeChecklist(checklist: ChecklistItem[]): ChecklistItem[] {
  return checklist
    .map((e) => ({ ...e, label: e.label.trim() }))
    .filter((e) => e.label !== '');
}
