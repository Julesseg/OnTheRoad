import { describe, it, expect } from 'vitest';
import { dayIdForDate, reconcileDays } from './trip-days';
import type { Day, Item, Trip } from './schema';

function tripFixture(): Trip {
  return {
    id: 'trip-1',
    schemaVersion: 3,
    title: 'Coast',
    startDate: '2026-07-01',
    endDate: '2026-07-02',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    days: [
      { id: 'day-1', date: '2026-07-01', items: [] },
      { id: 'day-2', date: '2026-07-02', items: [] },
    ],
  };
}

describe('dayIdForDate', () => {
  it('resolves the day on the picked local date, ignoring its time component', () => {
    // The graphical picker hands back a Date carrying a time; only the local Y-M-D matters.
    const picked = new Date(2026, 6, 2, 15, 30); // Jul 2 2026, 15:30 local
    expect(dayIdForDate(tripFixture(), picked)).toBe('day-2');
  });

  it('returns null for a date that is not one of the trip days', () => {
    const picked = new Date(2026, 6, 5); // Jul 5 2026 — outside the trip span
    expect(dayIdForDate(tripFixture(), picked)).toBeNull();
  });
});

// Deterministic id generator so newly-appended days have predictable ids.
function sequentialIds(): () => string {
  let n = 0;
  return () => `new-${++n}`;
}

function day(over: Partial<Day> & Pick<Day, 'id' | 'date'>): Day {
  return { items: [], ...over };
}

function notes(...ids: string[]): Item[] {
  return ids.map((id) => ({ category: 'note' as const, id, name: id }));
}

// Convenience views for asserting the shape of a reconciled list.
const idsAndDates = (days: Day[]) => days.map((d) => [d.id, d.date]);
const itemIds = (days: Day[]) => days.map((d) => d.items.map((i) => i.id));

describe('reconcileDays — building from nothing (create)', () => {
  it('builds one empty day per date in range, defaulting to adjust', () => {
    const days = reconcileDays([], '2026-07-01', '2026-07-03', 'adjust', sequentialIds());
    expect(days.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(days.every((d) => d.items.length === 0)).toBe(true);
    expect(days.map((d) => d.id)).toEqual(['new-1', 'new-2', 'new-3']);
  });
});

describe('reconcileDays — shift', () => {
  it('re-dates every day by the offset, preserving ids, items, order and duration (no overlap)', () => {
    const existing = [
      day({ id: 'd1', date: '2026-07-01', items: notes('a') }),
      day({ id: 'd2', date: '2026-07-02', items: notes('b', 'c') }),
    ];
    // Move the whole trip a week later; duration is locked, so the caller passes Jul 8–9.
    const days = reconcileDays(existing, '2026-07-08', '2026-07-09', 'shift', sequentialIds());
    expect(idsAndDates(days)).toEqual([
      ['d1', '2026-07-08'],
      ['d2', '2026-07-09'],
    ]);
    expect(itemIds(days)).toEqual([['a'], ['b', 'c']]);
  });

  it('re-dates positionally even when the new window overlaps the old, never matching by date', () => {
    const existing = [
      day({ id: 'd1', date: '2026-07-01', items: notes('a') }),
      day({ id: 'd2', date: '2026-07-02', items: notes('b') }),
      day({ id: 'd3', date: '2026-07-03', items: notes('c') }),
    ];
    // Shift one day later: Jul 1–3 → Jul 2–4. Day 1 stays Day 1 (its items ride along).
    const days = reconcileDays(existing, '2026-07-02', '2026-07-04', 'shift', sequentialIds());
    expect(idsAndDates(days)).toEqual([
      ['d1', '2026-07-02'],
      ['d2', '2026-07-03'],
      ['d3', '2026-07-04'],
    ]);
    expect(itemIds(days)).toEqual([['a'], ['b'], ['c']]);
  });
});

describe('reconcileDays — adjust', () => {
  it('keeps an in-window date intact (its id and items) and fills new dates with empty days', () => {
    const existing = [day({ id: 'd2', date: '2026-07-02', items: notes('keep') })];
    // Window grows one day earlier and one day later around the kept day.
    const days = reconcileDays(existing, '2026-07-01', '2026-07-03', 'adjust', sequentialIds());
    expect(idsAndDates(days)).toEqual([
      ['new-1', '2026-07-01'],
      ['d2', '2026-07-02'],
      ['new-2', '2026-07-03'],
    ]);
    expect(itemIds(days)).toEqual([[], ['keep'], []]);
  });

  it('carries before-start items onto the first surviving day, after its own items', () => {
    const existing = [
      day({ id: 'd1', date: '2026-07-01', items: notes('a') }),
      day({ id: 'd2', date: '2026-07-02', items: notes('b') }),
      day({ id: 'd3', date: '2026-07-03', items: notes('c') }),
    ];
    const days = reconcileDays(existing, '2026-07-02', '2026-07-03', 'adjust', sequentialIds());
    expect(idsAndDates(days)).toEqual([
      ['d2', '2026-07-02'],
      ['d3', '2026-07-03'],
    ]);
    expect(itemIds(days)).toEqual([['b', 'a'], ['c']]);
  });

  it('carries after-end items onto the last surviving day, after its own items', () => {
    const existing = [
      day({ id: 'd1', date: '2026-07-01', items: notes('a') }),
      day({ id: 'd2', date: '2026-07-02', items: notes('b') }),
      day({ id: 'd3', date: '2026-07-03', items: notes('c') }),
    ];
    const days = reconcileDays(existing, '2026-07-01', '2026-07-02', 'adjust', sequentialIds());
    expect(idsAndDates(days)).toEqual([
      ['d1', '2026-07-01'],
      ['d2', '2026-07-02'],
    ]);
    expect(itemIds(days)).toEqual([['a'], ['b', 'c']]);
  });

  it('collapses overflow at both ends onto edge days that already hold items, in ascending date order', () => {
    const existing = [
      day({ id: 'b0', date: '2026-06-30', items: notes('x') }),
      day({ id: 'b1', date: '2026-07-01', items: notes('z') }),
      day({ id: 'd2', date: '2026-07-02', items: notes('b') }),
      day({ id: 'd3', date: '2026-07-03', items: notes('c') }),
      day({ id: 'a1', date: '2026-07-04', items: notes('y') }),
      day({ id: 'a2', date: '2026-07-05', items: notes('w') }),
    ];
    const days = reconcileDays(existing, '2026-07-02', '2026-07-03', 'adjust', sequentialIds());
    expect(idsAndDates(days)).toEqual([
      ['d2', '2026-07-02'],
      ['d3', '2026-07-03'],
    ]);
    // Native items first, then overflow appended in ascending date order.
    expect(itemIds(days)).toEqual([
      ['b', 'x', 'z'],
      ['c', 'y', 'w'],
    ]);
  });

  it('does not mutate the input days when carrying items to an edge', () => {
    const existing = [
      day({ id: 'd1', date: '2026-07-01', items: notes('a') }),
      day({ id: 'd2', date: '2026-07-02', items: notes('b') }),
    ];
    const snapshot = JSON.parse(JSON.stringify(existing));
    reconcileDays(existing, '2026-07-02', '2026-07-02', 'adjust', sequentialIds());
    expect(existing).toEqual(snapshot);
  });
});
