import { describe, it, expect } from 'vitest';
import type { Trip } from './schema';
import { resolveNextUp } from './next-up';

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    schemaVersion: 3,
    title: 'Pacific Coast Highway',
    startDate: '2026-07-01',
    endDate: '2026-07-03',
    days: [
      { id: 'day-1', date: '2026-07-01', items: [] },
      { id: 'day-2', date: '2026-07-02', items: [] },
      { id: 'day-3', date: '2026-07-03', items: [] },
    ],
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('resolveNextUp', () => {
  it('returns null when trip has not started yet', () => {
    const now = new Date(2026, 5, 28, 9, 0); // June 28
    expect(resolveNextUp(makeTrip(), now)).toBeNull();
  });

  it('returns null when trip has already ended', () => {
    const now = new Date(2026, 6, 10, 9, 0); // July 10
    expect(resolveNextUp(makeTrip(), now)).toBeNull();
  });

  it('returns null when no day object matches today', () => {
    const trip = makeTrip({ days: [] });
    const now = new Date(2026, 6, 2, 9, 0); // July 2 — in range but no day
    expect(resolveNextUp(trip, now)).toBeNull();
  });

  it('returns null when today\'s day is empty', () => {
    const now = new Date(2026, 6, 2, 9, 0);
    expect(resolveNextUp(makeTrip(), now)).toBeNull();
  });

  it('returns { dayId, itemId } for the next upcoming timed item today', () => {
    const trip = makeTrip({
      days: [
        { id: 'day-1', date: '2026-07-01', items: [] },
        {
          id: 'day-2',
          date: '2026-07-02',
          items: [
            { category: 'activity' as const, id: 'a1', name: 'Breakfast', time: '09:00' },
            { category: 'location' as const, id: 'l1', name: 'Beach', time: '11:00' },
          ],
        },
        { id: 'day-3', date: '2026-07-03', items: [] },
      ],
    });
    // 10:00 — Breakfast (09:00) has passed, Beach (11:00) is next
    const now = new Date(2026, 6, 2, 10, 0);
    expect(resolveNextUp(trip, now)).toEqual({ dayId: 'day-2', itemId: 'l1' });
  });

  it('returns null when today\'s day has only untimed items', () => {
    const trip = makeTrip({
      days: [
        { id: 'day-1', date: '2026-07-01', items: [] },
        {
          id: 'day-2',
          date: '2026-07-02',
          items: [
            { category: 'note' as const, id: 'n1', name: 'remember sunscreen' },
            { category: 'location' as const, id: 'l1', name: 'Lookout' }, // no time
          ],
        },
        { id: 'day-3', date: '2026-07-03', items: [] },
      ],
    });
    const now = new Date(2026, 6, 2, 9, 0);
    expect(resolveNextUp(trip, now)).toBeNull();
  });

  it('returns null when all timed items today have passed', () => {
    const trip = makeTrip({
      startDate: '2026-07-02',
      endDate: '2026-07-02',
      days: [
        {
          id: 'day-2',
          date: '2026-07-02',
          items: [
            { category: 'activity' as const, id: 'a1', name: 'Breakfast', time: '08:00' },
            { category: 'activity' as const, id: 'a2', name: 'Lunch', time: '12:00' },
          ],
        },
      ],
    });
    const now = new Date(2026, 6, 2, 23, 0);
    expect(resolveNextUp(trip, now)).toBeNull();
  });
});
