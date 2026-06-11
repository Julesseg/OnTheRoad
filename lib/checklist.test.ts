import { describe, it, expect } from 'vitest';
import { checklistProgress, moveEntry, sanitizeChecklist } from './checklist';
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

describe('moveEntry', () => {
  const list = entries(false, true, false); // ids c0, c1, c2

  it('moves an entry one step earlier', () => {
    expect(moveEntry(list, 'c2', -1).map((e) => e.id)).toEqual(['c0', 'c2', 'c1']);
  });

  it('moves an entry one step later', () => {
    expect(moveEntry(list, 'c0', 1).map((e) => e.id)).toEqual(['c1', 'c0', 'c2']);
  });

  it('returns the list unchanged when the move would leave the bounds', () => {
    expect(moveEntry(list, 'c0', -1)).toBe(list);
    expect(moveEntry(list, 'c2', 1)).toBe(list);
  });

  it('returns the list unchanged for an unknown entry and does not mutate the input', () => {
    expect(moveEntry(list, 'missing', 1)).toBe(list);
    moveEntry(list, 'c2', -1);
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
