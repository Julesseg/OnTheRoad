import { describe, it, expect } from 'vitest';
import { formatItem, linkify, sortItemsByTime, itemTime } from './item-display';
import type { Item } from './schema';

describe('formatItem — v3 unified', () => {
  it('uses item name as title and category label as typeLabel', () => {
    const item: Item = { id: 'a', name: 'Golden Gate Bridge', category: 'location' };
    const display = formatItem(item);
    expect(display.title).toBe('Golden Gate Bridge');
    expect(display.typeLabel).toBe('Place');
  });

  it('shows no lines when only name and category are set', () => {
    const item: Item = { id: 'a', name: 'Walk', category: 'activity' };
    expect(formatItem(item).lines).toEqual([]);
  });

  it('lists location address, time, and notes in order, omitting absent ones', () => {
    const item: Item = {
      id: 'a', name: 'Golden Gate', category: 'location',
      location: { address: '100 Bridge Way' },
      time: '09:30',
      notes: 'Great view',
    };
    const display = formatItem(item);
    expect(display.lines).toEqual(['100 Bridge Way', 'At 09:30', 'Great view']);
  });

  it('omits the address line when location has only coords (no address)', () => {
    const item: Item = { id: 'a', name: 'Viewpoint', category: 'location', location: { lat: 37.8, lng: -122.4 } };
    expect(formatItem(item).lines).toEqual([]);
  });

  it('shows time and notes for a stay item', () => {
    const item: Item = { id: 'b', name: 'Sea Cliff Inn', category: 'stay', time: '15:00', notes: 'Ask for sea view' };
    const display = formatItem(item);
    expect(display.typeLabel).toBe('Stay');
    expect(display.lines).toEqual(['At 15:00', 'Ask for sea view']);
  });

  it('shows time and notes for a meal item', () => {
    const item: Item = { id: 'c', name: 'Taco truck', category: 'meal', time: '12:00', notes: 'Cash only' };
    const display = formatItem(item);
    expect(display.typeLabel).toBe('Meal');
    expect(display.lines).toEqual(['At 12:00', 'Cash only']);
  });

  it('shows notes for a note item; name serves as the title', () => {
    const item: Item = { id: 'd', name: 'Remember sunscreen', category: 'note', notes: 'SPF 50+\nAlso a hat' };
    const display = formatItem(item);
    expect(display.typeLabel).toBe('Note');
    expect(display.title).toBe('Remember sunscreen');
    expect(display.lines).toContain('SPF 50+\nAlso a hat');
  });
});

describe('itemTime', () => {
  it('returns the item time for any category', () => {
    const item: Item = { id: 'a', name: 'Walk', category: 'activity', time: '09:00' };
    expect(itemTime(item)).toBe('09:00');
  });

  it('returns undefined when the item has no time', () => {
    const item: Item = { id: 'a', name: 'Note', category: 'note' };
    expect(itemTime(item)).toBeUndefined();
  });
});

describe('sortItemsByTime', () => {
  const ids = (items: Item[]) => items.map((i) => i.id);

  it('orders timed items ascending by time', () => {
    const items: Item[] = [
      { id: 'c', name: 'Dinner', category: 'activity', time: '19:00' },
      { id: 'a', name: 'Breakfast', category: 'meal', time: '09:00' },
      { id: 'b', name: 'Museum', category: 'location', time: '11:00' },
    ];
    expect(ids(sortItemsByTime(items))).toEqual(['a', 'b', 'c']);
  });

  it('places untimed items after timed ones, preserving their relative order', () => {
    const items: Item[] = [
      { id: 'n1', name: 'First note', category: 'note' },
      { id: 'l1', name: 'Lookout', category: 'location', time: '08:00' },
      { id: 'n2', name: 'Second note', category: 'note' },
    ];
    expect(ids(sortItemsByTime(items))).toEqual(['l1', 'n1', 'n2']);
  });

  it('does not mutate the input array', () => {
    const items: Item[] = [
      { id: 'c', name: 'Dinner', category: 'activity', time: '19:00' },
      { id: 'a', name: 'Breakfast', category: 'activity', time: '09:00' },
    ];
    sortItemsByTime(items);
    expect(ids(items)).toEqual(['c', 'a']);
  });
});

describe('linkify', () => {
  it('returns a single text segment when there are no links', () => {
    expect(linkify('just plain text')).toEqual([{ kind: 'text', value: 'just plain text' }]);
  });

  it('splits an embedded http(s) URL into its own segment', () => {
    expect(linkify('see https://example.com/tickets for info')).toEqual([
      { kind: 'text', value: 'see ' },
      { kind: 'url', value: 'https://example.com/tickets', href: 'https://example.com/tickets' },
      { kind: 'text', value: ' for info' },
    ]);
  });

  it('splits a phone number into a tel segment with digits-only href', () => {
    expect(linkify('call 555-123-4567 now')).toEqual([
      { kind: 'text', value: 'call ' },
      { kind: 'phone', value: '555-123-4567', href: 'tel:5551234567' },
      { kind: 'text', value: ' now' },
    ]);
  });

  it('does not treat an ISO date (YYYY-MM-DD) as a phone number', () => {
    expect(linkify('depart 2026-07-01 early')).toEqual([
      { kind: 'text', value: 'depart 2026-07-01 early' },
    ]);
  });
});
