import { describe, it, expect, beforeEach } from 'vitest';
import {
  checklistProgress,
  insertEntryAfter,
  moveEntries,
  removeEntry,
  sanitizeChecklist,
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

describe('insertEntryAfter', () => {
  let n = 0;
  const makeId = () => `new${n++}`;
  beforeEach(() => {
    n = 0;
  });

  it('inserts a fresh blank row directly below the given one and focuses it', () => {
    const list = labelled('First', 'Last'); // ids c0, c1
    const { checklist, focusId } = insertEntryAfter(list, 'c0', makeId);
    expect(checklist.map((e) => e.label)).toEqual(['First', '', 'Last']);
    expect(checklist.map((e) => e.id)).toEqual(['c0', 'new0', 'c1']);
    expect(checklist[1]).toMatchObject({ label: '', checked: false });
    expect(focusId).toBe('new0');
  });

  it('leaves the current row’s text untouched', () => {
    const list = labelled('Keep me'); // c0
    const { checklist } = insertEntryAfter(list, 'c0', makeId);
    expect(checklist[0]).toMatchObject({ id: 'c0', label: 'Keep me' });
  });

  it('appends to the end when the id is missing', () => {
    const list = labelled('A', 'B');
    const { checklist, focusId } = insertEntryAfter(list, 'nope', makeId);
    expect(checklist.map((e) => e.label)).toEqual(['A', 'B', '']);
    expect(focusId).toBe('new0');
  });
});

describe('removeEntry', () => {
  it('removes the row and points focus at the end of the row above', () => {
    const list = labelled('Passport', ''); // c0, c1
    const { checklist, focus } = removeEntry(list, 'c1');
    expect(checklist.map((e) => e.label)).toEqual(['Passport']);
    expect(focus).toEqual({ id: 'c0', cursor: 'Passport'.length });
  });

  it('returns null focus when the first row is removed (nothing above)', () => {
    const list = labelled('', 'World');
    const { checklist, focus } = removeEntry(list, 'c0');
    expect(checklist.map((e) => e.label)).toEqual(['World']);
    expect(focus).toBeNull();
  });

  it('is a no-op when the id is missing', () => {
    const list = labelled('A', 'B');
    const { checklist, focus } = removeEntry(list, 'nope');
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
