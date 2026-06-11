import type { ChecklistItem } from './schema';

/** Progress label for a checklist, e.g. "2/5" — checked count over total. */
export function checklistProgress(checklist: ChecklistItem[]): string {
  const done = checklist.filter((e) => e.checked).length;
  return `${done}/${checklist.length}`;
}

/** Move `entryId` by `offset` positions (-1 = up, +1 = down). Pure.
 * Returns the input list unchanged when the entry is unknown or the move
 * would leave the bounds. */
export function moveEntry(
  checklist: ChecklistItem[],
  entryId: string,
  offset: number,
): ChecklistItem[] {
  const from = checklist.findIndex((e) => e.id === entryId);
  const to = from + offset;
  if (from === -1 || to < 0 || to >= checklist.length) return checklist;
  const next = [...checklist];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/** Trim entry labels and drop the entries left empty — run on editor save so
 * half-typed rows never reach storage. Pure. */
export function sanitizeChecklist(checklist: ChecklistItem[]): ChecklistItem[] {
  return checklist
    .map((e) => ({ ...e, label: e.label.trim() }))
    .filter((e) => e.label !== '');
}
