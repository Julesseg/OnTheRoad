import type { ChecklistItem } from './schema';

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
