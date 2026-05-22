import { describe, it, expect } from 'vitest';
import { formatItem, linkify } from './item-display';
import type { Item } from './schema';

describe('formatItem — location', () => {
  it('uses the name as title and shows no lines when only required fields are set', () => {
    const item: Item = { type: 'location', id: 'a', name: 'Golden Gate Bridge' };
    const display = formatItem(item);
    expect(display.typeLabel).toBe('Location');
    expect(display.title).toBe('Golden Gate Bridge');
    expect(display.lines).toEqual([]);
  });

  it('lists address, time, and notes in order, omitting absent fields', () => {
    const item: Item = {
      type: 'location',
      id: 'a',
      name: 'Golden Gate Bridge',
      address: '100 Bridge Way',
      time: '09:30',
      notes: 'Great view at sunrise',
    };
    const display = formatItem(item);
    expect(display.lines).toEqual(['100 Bridge Way', 'At 09:30', 'Great view at sunrise']);
  });
});

describe('formatItem — accommodation', () => {
  it('shows address, check-in/out, confirmation, and notes', () => {
    const item: Item = {
      type: 'accommodation',
      id: 'b',
      name: 'Sea Cliff Inn',
      address: '5 Ocean Ave',
      checkIn: '15:00',
      checkOut: '11:00',
      confirmationNumber: 'XYZ123',
      notes: 'Ask for an ocean view',
    };
    const display = formatItem(item);
    expect(display.typeLabel).toBe('Accommodation');
    expect(display.title).toBe('Sea Cliff Inn');
    expect(display.lines).toEqual([
      '5 Ocean Ave',
      'Check-in 15:00',
      'Check-out 11:00',
      'Confirmation XYZ123',
      'Ask for an ocean view',
    ]);
  });
});

describe('formatItem — activity', () => {
  it('shows time, duration in minutes, and notes', () => {
    const item: Item = {
      type: 'activity',
      id: 'c',
      name: 'Whale watching',
      time: '08:00',
      duration: 120,
      notes: 'Bring a jacket',
    };
    const display = formatItem(item);
    expect(display.typeLabel).toBe('Activity');
    expect(display.title).toBe('Whale watching');
    expect(display.lines).toEqual(['At 08:00', '120 min', 'Bring a jacket']);
  });
});

describe('formatItem — note', () => {
  it('labels the type Note and renders the text as a line so it can be linkified', () => {
    const item: Item = { type: 'note', id: 'd', text: 'Remember sunscreen' };
    const display = formatItem(item);
    expect(display.typeLabel).toBe('Note');
    expect(display.title).toBe('Note');
    expect(display.lines).toEqual(['Remember sunscreen']);
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

  it('detects a url and a phone in the same string, in order', () => {
    expect(linkify('book https://x.io or call 555-123-4567')).toEqual([
      { kind: 'text', value: 'book ' },
      { kind: 'url', value: 'https://x.io', href: 'https://x.io' },
      { kind: 'text', value: ' or call ' },
      { kind: 'phone', value: '555-123-4567', href: 'tel:5551234567' },
    ]);
  });
});
