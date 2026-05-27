import { describe, it, expect } from 'vitest';
import type { Day, Item, Trip } from './schema';
import { nextItemId, selectTodayDay } from './today';

function makeDay(items: Item[]): Day {
  return { id: 'day-1', date: '2026-07-02', items };
}

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    schemaVersion: 1,
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

describe('selectTodayDay', () => {
  it('returns the matching day with kind "today" when now is in range', () => {
    const result = selectTodayDay(makeTrip(), new Date(2026, 6, 2, 9, 0));
    expect(result.kind).toBe('today');
    expect(result.day?.id).toBe('day-2');
    expect(result.daysAway).toBe(0);
  });

  it('returns kind "before" with daysAway and the first day when now precedes the trip', () => {
    const result = selectTodayDay(makeTrip(), new Date(2026, 5, 28, 9, 0));
    expect(result.kind).toBe('before');
    expect(result.daysAway).toBe(3);
    expect(result.day?.id).toBe('day-1');
  });

  it('returns kind "after" with the last day when the trip has ended', () => {
    const result = selectTodayDay(makeTrip(), new Date(2026, 6, 10, 9, 0));
    expect(result.kind).toBe('after');
    expect(result.day?.id).toBe('day-3');
  });

  it('treats the start and end boundaries as in-progress', () => {
    expect(selectTodayDay(makeTrip(), new Date(2026, 6, 1, 0, 0)).kind).toBe('today');
    expect(selectTodayDay(makeTrip(), new Date(2026, 6, 3, 23, 59)).kind).toBe('today');
  });
});

describe('nextItemId', () => {
  it('returns the first item whose time is at or after now', () => {
    const day = makeDay([
      { type: 'activity', id: 'a', name: 'Breakfast', time: '09:00' },
      { type: 'location', id: 'b', name: 'Museum', time: '11:00' },
      { type: 'activity', id: 'c', name: 'Dinner', time: '19:00' },
    ]);
    expect(nextItemId(day, new Date(2026, 6, 2, 10, 0))).toBe('b');
  });

  it('picks the chronologically earliest upcoming item even when stored out of order', () => {
    const day = makeDay([
      { type: 'location', id: 'late', name: 'Museum', time: '11:00' },
      { type: 'activity', id: 'early', name: 'Breakfast', time: '09:00' },
    ]);
    expect(nextItemId(day, new Date(2026, 6, 2, 8, 0))).toBe('early');
  });

  it('uses an accommodation check-in as its time', () => {
    const day = makeDay([
      { type: 'accommodation', id: 'hotel', name: 'Seaside Inn', checkIn: '15:00' },
    ]);
    expect(nextItemId(day, new Date(2026, 6, 2, 12, 0))).toBe('hotel');
  });

  it('falls back to the first item when no item has a time', () => {
    const day = makeDay([
      { type: 'note', id: 'n1', text: 'remember sunscreen' },
      { type: 'location', id: 'l1', name: 'Lookout' },
    ]);
    expect(nextItemId(day, new Date(2026, 6, 2, 12, 0))).toBe('n1');
  });

  it('returns null when timed items have all passed', () => {
    const day = makeDay([
      { type: 'activity', id: 'a', name: 'Breakfast', time: '08:00' },
      { type: 'activity', id: 'b', name: 'Lunch', time: '12:00' },
    ]);
    expect(nextItemId(day, new Date(2026, 6, 2, 23, 0))).toBeNull();
  });

  it('returns null for an empty day', () => {
    expect(nextItemId(makeDay([]), new Date(2026, 6, 2, 9, 0))).toBeNull();
  });
});
