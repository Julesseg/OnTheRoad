import { describe, it, expect } from 'vitest';
import type { Trip } from './schema';
import { buildItineraryRows } from './itinerary-rows';

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    schemaVersion: 2,
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

const BEFORE_TRIP = new Date(2026, 5, 28, 9, 0); // June 28 — Upcoming

describe('buildItineraryRows', () => {
  it('produces a dayHeader for each day in date order with correct dayNumber', () => {
    const rows = buildItineraryRows(makeTrip(), BEFORE_TRIP);
    const headers = rows.filter((r) => r.kind === 'dayHeader');
    expect(headers).toHaveLength(3);
    expect(headers[0]).toMatchObject({ kind: 'dayHeader', dayId: 'day-1', dayNumber: 1, date: '2026-07-01' });
    expect(headers[1]).toMatchObject({ kind: 'dayHeader', dayId: 'day-2', dayNumber: 2, date: '2026-07-02' });
    expect(headers[2]).toMatchObject({ kind: 'dayHeader', dayId: 'day-3', dayNumber: 3, date: '2026-07-03' });
  });

  it('includes day notes in the dayHeader', () => {
    const trip = makeTrip({
      startDate: '2026-07-01',
      endDate: '2026-07-01',
      days: [{ id: 'day-1', date: '2026-07-01', items: [], notes: 'Pack sunscreen' }],
    });
    const [header] = buildItineraryRows(trip, BEFORE_TRIP);
    expect(header).toMatchObject({ kind: 'dayHeader', notes: 'Pack sunscreen' });
  });

  it('emits item rows after their dayHeader in stored array order, not time order', () => {
    const trip = makeTrip({
      startDate: '2026-07-01',
      endDate: '2026-07-01',
      days: [
        {
          id: 'day-1',
          date: '2026-07-01',
          items: [
            { type: 'location', id: 'l1', name: 'Malibu', time: '11:00' },
            { type: 'activity', id: 'a1', name: 'Breakfast', time: '09:00' },
          ],
        },
      ],
    });
    const rows = buildItineraryRows(trip, BEFORE_TRIP);
    expect(rows[0]).toMatchObject({ kind: 'dayHeader', dayId: 'day-1' });
    expect(rows[1]).toMatchObject({ kind: 'item', item: { id: 'l1' } }); // stored first
    expect(rows[2]).toMatchObject({ kind: 'item', item: { id: 'a1' } }); // stored second
  });

  it('emits no item rows for an empty day', () => {
    const rows = buildItineraryRows(makeTrip(), BEFORE_TRIP);
    expect(rows.filter((r) => r.kind === 'item')).toHaveLength(0);
  });

  it('prepends a nextUp row when In progress and a next item exists', () => {
    const trip = makeTrip({
      days: [
        { id: 'day-1', date: '2026-07-01', items: [] },
        {
          id: 'day-2',
          date: '2026-07-02',
          items: [{ type: 'activity', id: 'a1', name: 'Lunch', time: '12:00' }],
        },
        { id: 'day-3', date: '2026-07-03', items: [] },
      ],
    });
    const inProgress = new Date(2026, 6, 2, 10, 0); // July 2, 10:00
    const rows = buildItineraryRows(trip, inProgress);
    expect(rows[0]).toMatchObject({ kind: 'nextUp', dayId: 'day-2', itemId: 'a1' });
  });

  it('omits the nextUp row when trip is not In progress', () => {
    const rows = buildItineraryRows(makeTrip(), BEFORE_TRIP);
    expect(rows.some((r) => r.kind === 'nextUp')).toBe(false);
  });

  it('omits the nextUp row when In progress but all timed items today have passed', () => {
    const trip = makeTrip({
      days: [
        { id: 'day-1', date: '2026-07-01', items: [] },
        {
          id: 'day-2',
          date: '2026-07-02',
          items: [{ type: 'activity', id: 'a1', name: 'Breakfast', time: '08:00' }],
        },
        { id: 'day-3', date: '2026-07-03', items: [] },
      ],
    });
    const lateInDay = new Date(2026, 6, 2, 10, 0); // 10:00, breakfast at 08:00 has passed
    const rows = buildItineraryRows(trip, lateInDay);
    expect(rows.some((r) => r.kind === 'nextUp')).toBe(false);
  });
});
