import { describe, it, expect } from 'vitest';
import {
  upsertItemInTrip,
  deleteItemFromTrip,
  moveItemToDay,
  reorderItemInDay,
  toggleChecklistEntryInTrip,
} from './trip-mutations';
import type { Trip, Item } from './schema';

const NOW = '2026-06-01T12:00:00.000Z';

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
      { id: 'day-1', date: '2026-07-01', items: [{ category: 'note' as const, id: 'i1', name: 'first' }] },
      { id: 'day-2', date: '2026-07-02', items: [] },
    ],
  };
}

function notes(...ids: string[]): Item[] {
  return ids.map((id) => ({ category: 'note' as const, id, name: id }));
}

describe('upsertItemInTrip', () => {
  it('appends a new item to the target day and bumps updatedAt', () => {
    const item: Item = { category: 'note', id: 'i2', name: 'second' };
    const next = upsertItemInTrip(tripFixture(), 'day-1', item, NOW);
    expect(next.days[0].items.map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(next.updatedAt).toBe(NOW);
  });

  it('leaves other days untouched', () => {
    const item: Item = { category: 'note', id: 'i2', name: 'second' };
    const next = upsertItemInTrip(tripFixture(), 'day-1', item, NOW);
    expect(next.days[1].items).toEqual([]);
  });

  it('replaces an existing item in place, preserving order', () => {
    const trip = tripFixture();
    trip.days[0].items.push({ category: 'note', id: 'i2', name: 'second' });
    const edited: Item = { category: 'note', id: 'i1', name: 'edited' };
    const next = upsertItemInTrip(trip, 'day-1', edited, NOW);
    expect(next.days[0].items).toEqual([
      { category: 'note', id: 'i1', name: 'edited' },
      { category: 'note', id: 'i2', name: 'second' },
    ]);
  });

  it('does not mutate the input trip', () => {
    const trip = tripFixture();
    upsertItemInTrip(trip, 'day-1', { category: 'note', id: 'i2', name: 'x' }, NOW);
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

describe('reorderItemInDay', () => {
  it('drags an item down to a later position (SwiftUI move semantics)', () => {
    const trip = tripFixture();
    trip.days[0].items = notes('a', 'b', 'c');
    const next = reorderItemInDay(trip, 'day-1', [0], 2, NOW);
    expect(next.days[0].items.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('drags an item up to an earlier position', () => {
    const trip = tripFixture();
    trip.days[0].items = notes('a', 'b', 'c');
    const next = reorderItemInDay(trip, 'day-1', [2], 0, NOW);
    expect(next.days[0].items.map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('returns the trip unchanged when the drop leaves the order intact', () => {
    const trip = tripFixture();
    trip.days[0].items = notes('a', 'b', 'c');
    const next = reorderItemInDay(trip, 'day-1', [1], 2, NOW);
    expect(next).toBe(trip);
  });

  it('returns the trip unchanged when the day is not in the trip', () => {
    const trip = tripFixture();
    const next = reorderItemInDay(trip, 'day-missing', [0], 1, NOW);
    expect(next).toBe(trip);
  });

  it('bumps updatedAt and does not mutate the input trip', () => {
    const trip = tripFixture();
    trip.days[0].items = notes('a', 'b', 'c');
    const next = reorderItemInDay(trip, 'day-1', [0], 2, NOW);
    expect(next.updatedAt).toBe(NOW);
    expect(trip.days[0].items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('toggleChecklistEntryInTrip', () => {
  function tripWithChecklist(): Trip {
    const trip = tripFixture();
    trip.days[0].items = [
      {
        category: 'activity',
        id: 'i1',
        name: 'Pack bags',
        checklist: [
          { id: 'c1', label: 'Passport', checked: false },
          { id: 'c2', label: 'Sunscreen', checked: true },
        ],
      },
    ];
    return trip;
  }

  it('flips an unchecked entry to checked and bumps updatedAt', () => {
    const next = toggleChecklistEntryInTrip(tripWithChecklist(), 'day-1', 'i1', 'c1', NOW);
    expect(next.days[0].items[0].checklist).toEqual([
      { id: 'c1', label: 'Passport', checked: true },
      { id: 'c2', label: 'Sunscreen', checked: true },
    ]);
    expect(next.updatedAt).toBe(NOW);
  });

  it('flips a checked entry back to unchecked', () => {
    const next = toggleChecklistEntryInTrip(tripWithChecklist(), 'day-1', 'i1', 'c2', NOW);
    expect(next.days[0].items[0].checklist![1]).toEqual({ id: 'c2', label: 'Sunscreen', checked: false });
  });

  it('does not mutate the input trip', () => {
    const trip = tripWithChecklist();
    toggleChecklistEntryInTrip(trip, 'day-1', 'i1', 'c1', NOW);
    expect(trip.days[0].items[0].checklist![0].checked).toBe(false);
  });

  it('returns the trip unchanged when the entry does not exist', () => {
    const trip = tripWithChecklist();
    const next = toggleChecklistEntryInTrip(trip, 'day-1', 'i1', 'missing', NOW);
    expect(next).toBe(trip);
  });

  it('returns the trip unchanged when the item has no checklist', () => {
    const trip = tripFixture();
    const next = toggleChecklistEntryInTrip(trip, 'day-1', 'i1', 'c1', NOW);
    expect(next).toBe(trip);
  });
});
