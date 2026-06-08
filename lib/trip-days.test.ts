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

describe('reconcileDays', () => {
  it('builds one empty day per date in range when there are no existing days', () => {
    const { days } = reconcileDays([], '2026-07-01', '2026-07-03', sequentialIds());
    expect(days.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(days.every((d) => d.items.length === 0)).toBe(true);
    expect(days.map((d) => d.id)).toEqual(['new-1', 'new-2', 'new-3']);
  });

  it('keeps an in-range existing day intact — its id and items', () => {
    const existing = [
      day({ id: 'd1', date: '2026-07-01', items: notes('a') }),
    ];
    const { days } = reconcileDays(existing, '2026-07-01', '2026-07-02', sequentialIds());
    expect(days[0]).toEqual(existing[0]);
    expect(days[1]).toEqual({ id: 'new-1', date: '2026-07-02', items: [] });
  });

  it('drops days that fall outside the new range', () => {
    const existing = [
      day({ id: 'd1', date: '2026-07-01' }),
      day({ id: 'd2', date: '2026-07-02' }),
      day({ id: 'd3', date: '2026-07-03' }),
    ];
    // Narrow the range to the middle day only.
    const { days } = reconcileDays(existing, '2026-07-02', '2026-07-02', sequentialIds());
    expect(days.map((d) => d.id)).toEqual(['d2']);
  });

  it('reports dropped days that still hold items so the caller can warn', () => {
    const existing = [
      day({ id: 'd1', date: '2026-07-01', items: notes('a') }),
      day({ id: 'd2', date: '2026-07-02', items: [] }),
      day({ id: 'd3', date: '2026-07-03', items: notes('b', 'c') }),
    ];
    // Drop the first and last day; only those with items are flagged.
    const { droppedDaysWithItems } = reconcileDays(
      existing,
      '2026-07-02',
      '2026-07-02',
      sequentialIds(),
    );
    expect(droppedDaysWithItems.map((d) => d.id)).toEqual(['d1', 'd3']);
  });

  it('orders kept and newly-added days by date when the window shifts', () => {
    const existing = [day({ id: 'd2', date: '2026-07-02', items: notes('keep') })];
    // Window grows one day earlier and one day later around the kept day.
    const { days } = reconcileDays(existing, '2026-07-01', '2026-07-03', sequentialIds());
    expect(days.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(days.map((d) => d.id)).toEqual(['new-1', 'd2', 'new-2']);
    expect(days[1].items.map((i) => i.id)).toEqual(['keep']);
  });

  it('does not mutate the input days', () => {
    const existing = [day({ id: 'd1', date: '2026-07-01', items: notes('a') })];
    const snapshot = JSON.parse(JSON.stringify(existing));
    reconcileDays(existing, '2026-07-05', '2026-07-06', sequentialIds());
    expect(existing).toEqual(snapshot);
  });
});
