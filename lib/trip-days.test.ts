import { describe, it, expect } from 'vitest';
import { dayIdForDate } from './trip-days';
import type { Trip } from './schema';

function tripFixture(): Trip {
  return {
    id: 'trip-1',
    schemaVersion: 2,
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
