import { describe, it, expect } from 'vitest';
import {
  upsertItemInTrip,
  deleteItemFromTrip,
  reorderDayItems,
  moveItemToDay,
} from './trip-mutations';
import type { Trip, Item } from './schema';

const NOW = '2026-06-01T12:00:00.000Z';

function tripFixture(): Trip {
  return {
    id: 'trip-1',
    schemaVersion: 1,
    title: 'Coast',
    startDate: '2026-07-01',
    endDate: '2026-07-02',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    days: [
      { id: 'day-1', date: '2026-07-01', items: [{ type: 'note', id: 'i1', text: 'first' }] },
      { id: 'day-2', date: '2026-07-02', items: [] },
    ],
  };
}

function notes(...ids: string[]): Item[] {
  return ids.map((id) => ({ type: 'note', id, text: id }));
}

describe('upsertItemInTrip', () => {
  it('appends a new item to the target day and bumps updatedAt', () => {
    const item: Item = { type: 'note', id: 'i2', text: 'second' };
    const next = upsertItemInTrip(tripFixture(), 'day-1', item, NOW);
    expect(next.days[0].items.map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(next.updatedAt).toBe(NOW);
  });

  it('leaves other days untouched', () => {
    const item: Item = { type: 'note', id: 'i2', text: 'second' };
    const next = upsertItemInTrip(tripFixture(), 'day-1', item, NOW);
    expect(next.days[1].items).toEqual([]);
  });

  it('replaces an existing item in place, preserving order', () => {
    const trip = tripFixture();
    trip.days[0].items.push({ type: 'note', id: 'i2', text: 'second' });
    const edited: Item = { type: 'note', id: 'i1', text: 'edited' };
    const next = upsertItemInTrip(trip, 'day-1', edited, NOW);
    expect(next.days[0].items).toEqual([
      { type: 'note', id: 'i1', text: 'edited' },
      { type: 'note', id: 'i2', text: 'second' },
    ]);
  });

  it('does not mutate the input trip', () => {
    const trip = tripFixture();
    upsertItemInTrip(trip, 'day-1', { type: 'note', id: 'i2', text: 'x' }, NOW);
    expect(trip.days[0].items.map((i) => i.id)).toEqual(['i1']);
  });
});

describe('deleteItemFromTrip', () => {
  it('removes the item and bumps updatedAt', () => {
    const next = deleteItemFromTrip(tripFixture(), 'day-1', 'i1', NOW);
    expect(next.days[0].items).toEqual([]);
    expect(next.updatedAt).toBe(NOW);
  });

  it('does not mutate the input trip', () => {
    const trip = tripFixture();
    deleteItemFromTrip(trip, 'day-1', 'i1', NOW);
    expect(trip.days[0].items.map((i) => i.id)).toEqual(['i1']);
  });
});

describe('reorderDayItems', () => {
  it('moves an item from one index to a later one, shifting the rest', () => {
    const trip = tripFixture();
    trip.days[0].items = notes('a', 'b', 'c');
    const next = reorderDayItems(trip, 'day-1', 0, 2, NOW);
    expect(next.days[0].items.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(next.updatedAt).toBe(NOW);
  });

  it('moves an item to an earlier index', () => {
    const trip = tripFixture();
    trip.days[0].items = notes('a', 'b', 'c');
    const next = reorderDayItems(trip, 'day-1', 2, 0, NOW);
    expect(next.days[0].items.map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('does not mutate the input and leaves other days untouched', () => {
    const trip = tripFixture();
    trip.days[0].items = notes('a', 'b', 'c');
    const next = reorderDayItems(trip, 'day-1', 0, 2, NOW);
    expect(trip.days[0].items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(next.days[1]).toBe(trip.days[1]);
  });
});

describe('moveItemToDay', () => {
  it('removes the item from the source day and appends it to the end of the target day', () => {
    const trip = tripFixture();
    trip.days[0].items = notes('a', 'b');
    trip.days[1].items = notes('x');
    const next = moveItemToDay(trip, 'day-1', 'day-2', 'a', NOW);
    expect(next.days[0].items.map((i) => i.id)).toEqual(['b']);
    expect(next.days[1].items.map((i) => i.id)).toEqual(['x', 'a']);
    expect(next.updatedAt).toBe(NOW);
  });

  it('does not mutate the input trip', () => {
    const trip = tripFixture();
    trip.days[0].items = notes('a', 'b');
    moveItemToDay(trip, 'day-1', 'day-2', 'a', NOW);
    expect(trip.days[0].items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(trip.days[1].items).toEqual([]);
  });

  it('returns the trip unchanged when the item is not in the source day', () => {
    const trip = tripFixture();
    const next = moveItemToDay(trip, 'day-1', 'day-2', 'missing', NOW);
    expect(next).toBe(trip);
  });

  it('returns the trip unchanged when the target day is not in the trip', () => {
    const trip = tripFixture();
    trip.days[0].items = notes('a', 'b');
    const next = moveItemToDay(trip, 'day-1', 'day-missing', 'a', NOW);
    expect(next).toBe(trip);
  });
});
