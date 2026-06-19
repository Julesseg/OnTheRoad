import { describe, it, expect, beforeEach } from 'vitest';
import {
  checklistProgress,
  mergeEntryUp,
  moveEntries,
  sanitizeChecklist,
  splitEntry,
} from './checklist';
import type { ChecklistItem } from './schema';

function entries(...checked: boolean[]): ChecklistItem[] {
  return checked.map((c, i) => ({ id: `c${i}`, label: `entry ${i}`, checked: c }));
}

function labelled(...labels: string[]): ChecklistItem[] {
  return labels.map((label, i) => ({ id: `c${i}`, label, checked: i % 2 === 0 }));
}

describe('checklistProgress', () => {
  it('counts checked entries over the total, e.g. 2/5', () => {
    expect(checklistProgress(entries(true, false, true, false, false))).toBe('2/5');
  });

  it('reports 0/n when nothing is ticked', () => {
    expect(checklistProgress(entries(false, false))).toBe('0/2');
  });

  it('reports n/n when everything is ticked', () => {
    expect(checklistProgress(entries(true, true, true))).toBe('3/3');
  });
});

describe('moveEntries', () => {
  const list = entries(false, true, false); // ids c0, c1, c2

  it('moves an entry earlier (SwiftUI onMove: destination indexes the original array)', () => {
    expect(moveEntries(list, [2], 0).map((e) => e.id)).toEqual(['c2', 'c0', 'c1']);
  });

  it('moves an entry later — destination past the entry lands after it', () => {
    expect(moveEntries(list, [0], 2).map((e) => e.id)).toEqual(['c1', 'c0', 'c2']);
  });

  it('moves an entry to the end', () => {
    expect(moveEntries(list, [0], 3).map((e) => e.id)).toEqual(['c1', 'c2', 'c0']);
  });

  it('returns the list unchanged when the move is a no-op', () => {
    expect(moveEntries(list, [1], 1)).toBe(list);
    expect(moveEntries(list, [1], 2)).toBe(list);
  });

  it('ignores out-of-bounds sources and does not mutate the input', () => {
    expect(moveEntries(list, [7], 0)).toBe(list);
    moveEntries(list, [2], 0);
    expect(list.map((e) => e.id)).toEqual(['c0', 'c1', 'c2']);
  });
});

describe('splitEntry', () => {
  let n = 0;
  const makeId = () => `new${n++}`;
  beforeEach(() => {
    n = 0;
  });

  it('keeps `before` on the row and moves `after` to a fresh row right below it', () => {
    const list = labelled('Hello', 'Last'); // ids c0, c1
    const { checklist, focus } = splitEntry(list, 'c0', 'Hel', 'lo', makeId);
    expect(checklist.map((e) => e.label)).toEqual(['Hel', 'lo', 'Last']);
    expect(checklist.map((e) => e.id)).toEqual(['c0', 'new0', 'c1']);
    // The new row takes focus with the caret at its start (the moved tail).
    expect(focus).toEqual({ id: 'new0', cursor: 0 });
  });

  it('preserves the original row id and checked state, the new row starting unchecked', () => {
    const list = labelled('First'); // c0 is checked (even index)
    const { checklist } = splitEntry(list, 'c0', 'Fir', 'st', makeId);
    expect(checklist[0]).toMatchObject({ id: 'c0', label: 'Fir', checked: true });
    expect(checklist[1]).toMatchObject({ label: 'st', checked: false });
  });

  it('returns the list unchanged when the id is missing', () => {
    const list = labelled('A', 'B');
    const result = splitEntry(list, 'nope', 'x', 'y', makeId);
    expect(result.checklist).toBe(list);
  });
});

describe('mergeEntryUp', () => {
  it('appends the trailing text to the previous label and removes the row', () => {
    const list = labelled('Hello', 'World'); // c0, c1
    const { checklist, focus } = mergeEntryUp(list, 'c1', 'World');
    expect(checklist.map((e) => e.label)).toEqual(['HelloWorld']);
    expect(checklist[0].id).toBe('c0');
    // Caret lands at the join — the end of the original previous label.
    expect(focus).toEqual({ id: 'c0', cursor: 'Hello'.length });
  });

  it('merging an empty row just deletes it, caret at the end of the previous one', () => {
    const list = labelled('Passport', '');
    const { checklist, focus } = mergeEntryUp(list, 'c1', '');
    expect(checklist.map((e) => e.label)).toEqual(['Passport']);
    expect(focus).toEqual({ id: 'c0', cursor: 'Passport'.length });
  });

  it('is a no-op for the first row — nothing above to merge into', () => {
    const list = labelled('Hello', 'World');
    const { checklist, focus } = mergeEntryUp(list, 'c0', 'Hello');
    expect(checklist).toBe(list);
    expect(focus).toBeNull();
  });
});

describe('sanitizeChecklist', () => {
  it('trims labels and drops entries left empty', () => {
    const list: ChecklistItem[] = [
      { id: 'c0', label: '  Passport  ', checked: true },
      { id: 'c1', label: '   ', checked: false },
      { id: 'c2', label: '', checked: false },
    ];
    expect(sanitizeChecklist(list)).toEqual([{ id: 'c0', label: 'Passport', checked: true }]);
  });
});
