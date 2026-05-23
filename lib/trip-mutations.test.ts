import { describe, it, expect } from 'vitest';
import { upsertItemInTrip, deleteItemFromTrip } from './trip-mutations';
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
