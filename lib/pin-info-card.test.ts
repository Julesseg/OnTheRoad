import { describe, it, expect } from 'vitest';
import { findLocatedItem, pinInfoCard } from './pin-info-card';
import { itemIdentity } from './item-identity';
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
        items: [
          {
            category: 'meal',
            id: 'b',
            name: 'Lunch',
            time: '12:30',
            notes: 'Window table booked under Jules',
            location: { address: 'Big Sur', lat: 36.27, lng: -121.8 },
          },
        ],
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

describe('pinInfoCard', () => {
  it('carries the name, category accent/icon, time, and a notes snippet', () => {
    const item = makeTrip().days[1].items[0];
    const card = pinInfoCard(item);
    const identity = itemIdentity('meal');
    expect(card.name).toBe('Lunch');
    expect(card.accent).toBe(identity.accent);
    expect(card.symbol).toBe(identity.symbol);
    expect(card.time).toBe('12:30');
    expect(card.notesSnippet).toBe('Window table booked under Jules');
    expect(card.hasLocation).toBe(true);
  });

  it('truncates a long notes snippet with an ellipsis', () => {
    const card = pinInfoCard({ category: 'note', id: 'n', name: 'N', notes: 'x'.repeat(200) });
    expect(card.notesSnippet?.length).toBeLessThan(200);
    expect(card.notesSnippet?.endsWith('…')).toBe(true);
  });

  it('omits time and notes when the item has none', () => {
    const card = pinInfoCard({ category: 'location', id: 'a', name: 'A', location: { lat: 1, lng: 2 } });
    expect(card.time).toBeUndefined();
    expect(card.notesSnippet).toBeUndefined();
    expect(card.hasLocation).toBe(true);
  });
});
