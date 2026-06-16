import { describe, it, expect } from 'vitest';
import { findLocatedItem } from './pin-info-card';
import type { Trip } from './schema';

function makeTrip(): Trip {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    schemaVersion: 3,
    title: 'Test trip',
    startDate: '2099-07-01',
    endDate: '2099-07-02',
    days: [
      {
        id: 'd1',
        date: '2099-07-01',
        items: [{ category: 'location', id: 'a', name: 'Golden Gate', location: { lat: 37.8, lng: -122.4 } }],
      },
      {
        id: 'd2',
        date: '2099-07-02',
        items: [{ category: 'meal', id: 'b', name: 'Lunch', time: '12:30' }],
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('findLocatedItem', () => {
  it('finds an item by its id and reports the day it lives on', () => {
    const found = findLocatedItem(makeTrip(), 'b');
    expect(found?.item.name).toBe('Lunch');
    expect(found?.dayId).toBe('d2');
  });

  it('returns null for an unknown id', () => {
    expect(findLocatedItem(makeTrip(), 'nope')).toBeNull();
  });

  it('returns null when there is no trip', () => {
    expect(findLocatedItem(null, 'a')).toBeNull();
  });
});
