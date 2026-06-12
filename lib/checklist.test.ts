import { describe, it, expect } from 'vitest';
import { checklistProgress, moveEntries, sanitizeChecklist } from './checklist';
import type { ChecklistItem } from './schema';

function entries(...checked: boolean[]): ChecklistItem[] {
  return checked.map((c, i) => ({ id: `c${i}`, label: `entry ${i}`, checked: c }));
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
