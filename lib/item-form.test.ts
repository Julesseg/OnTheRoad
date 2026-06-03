import { describe, it, expect } from 'vitest';
import {
  formToItem,
  itemToForm,
  emptyForm,
  itemFormSchema,
  durationToHm,
  hmToDuration,
} from './item-form';
import type { Item } from './schema';

describe('duration ↔ hours/minutes', () => {
  it('splits stored whole minutes into hours and minutes (90 → 1h 30m)', () => {
    expect(durationToHm('90')).toEqual({ hours: 1, minutes: 30 });
  });

  it('treats an empty duration as unset (null)', () => {
    expect(durationToHm('')).toBeNull();
    expect(durationToHm('   ')).toBeNull();
  });

  it('preserves an odd, non-5-minute legacy value faithfully (7 → 0h 7m)', () => {
    expect(durationToHm('7')).toEqual({ hours: 0, minutes: 7 });
  });

  it('recombines hours and minutes into total whole minutes (1h 30m → 90)', () => {
    expect(hmToDuration(1, 30)).toBe('90');
    expect(hmToDuration(0, 5)).toBe('5');
    expect(hmToDuration(2, 0)).toBe('120');
  });

  it('round-trips a stored value through h/m and back unchanged', () => {
    expect(hmToDuration(durationToHm('90')!.hours, durationToHm('90')!.minutes)).toBe('90');
  });
});

describe('formToItem', () => {
  it('builds a location item, parsing "lat, lng" into numbers and dropping empty fields', () => {
    const item = formToItem(
      'location',
      { ...emptyForm(), name: 'Golden Gate', address: '100 Bridge Way', coords: '37.8199, -122.4783', time: '09:30' },
      'id-1',
    );
    expect(item).toEqual({
      type: 'location',
      id: 'id-1',
      name: 'Golden Gate',
      address: '100 Bridge Way',
      lat: 37.8199,
      lng: -122.4783,
      time: '09:30',
    });
  });

  it('builds an accommodation item with check-in/out and confirmation', () => {
    const item = formToItem(
      'accommodation',
      { ...emptyForm(), name: 'Seaside Inn', checkIn: '15:00', checkOut: '11:00', confirmationNumber: 'AB12' },
      'id-2',
    );
    expect(item).toEqual({
      type: 'accommodation',
      id: 'id-2',
      name: 'Seaside Inn',
      checkIn: '15:00',
      checkOut: '11:00',
      confirmationNumber: 'AB12',
    });
  });

  it('builds an activity item, coercing duration to a number', () => {
    const item = formToItem('activity', { ...emptyForm(), name: 'Hike', duration: '90' }, 'id-3');
    expect(item).toEqual({ type: 'activity', id: 'id-3', name: 'Hike', duration: 90 });
  });

  it('builds a note item from text only', () => {
    const item = formToItem('note', { ...emptyForm(), text: 'Remember sunscreen' }, 'id-4');
    expect(item).toEqual({ type: 'note', id: 'id-4', text: 'Remember sunscreen' });
  });

  it('drops a malformed coords string rather than emitting partial lat/lng', () => {
    const item = formToItem('location', { ...emptyForm(), name: 'X', coords: 'not coords' }, 'id-5');
    expect(item).toEqual({ type: 'location', id: 'id-5', name: 'X' });
  });

  it('carries attachments from the original item on edit, since the form does not surface them', () => {
    const original: Item = { type: 'location', id: 'id-6', name: 'Old', attachments: ['a.jpg', 'b.jpg'] };
    const edited = formToItem('location', { ...itemToForm(original), name: 'New' }, 'id-6', original);
    expect(edited).toEqual({ type: 'location', id: 'id-6', name: 'New', attachments: ['a.jpg', 'b.jpg'] });
  });

  it('preserves attachments across all item types on edit', () => {
    const note: Item = { type: 'note', id: 'n', text: 'hi', attachments: ['x.pdf'] };
    expect(formToItem('note', itemToForm(note), 'n', note)).toEqual(note);
  });
});

describe('itemToForm round-trips through formToItem', () => {
  const cases: Item[] = [
    { type: 'location', id: 'a', name: 'Pier', address: '1 Quay', lat: 47.6, lng: -122.3, time: '08:00', notes: 'early' },
    { type: 'accommodation', id: 'b', name: 'Inn', checkIn: '15:00', checkOut: '11:00', confirmationNumber: 'Z9', notes: 'quiet' },
    { type: 'activity', id: 'c', name: 'Kayak', time: '10:00', duration: 120 },
    { type: 'note', id: 'd', text: 'buy water' },
  ];
  it.each(cases)('round-trips a $type item', (original) => {
    const rebuilt = formToItem(original.type, itemToForm(original), original.id);
    expect(rebuilt).toEqual(original);
  });
});

describe('itemFormSchema validation', () => {
  function errorPaths(type: Parameters<typeof itemFormSchema>[0], values: Partial<ReturnType<typeof emptyForm>>) {
    const result = itemFormSchema(type).safeParse({ ...emptyForm(), ...values });
    return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
  }

  it('accepts a minimal valid location (name only)', () => {
    expect(errorPaths('location', { name: 'X' })).toEqual([]);
  });

  it('flags a missing name on a location', () => {
    expect(errorPaths('location', { name: '   ' })).toContain('name');
  });

  it('flags a missing text on a note', () => {
    expect(errorPaths('note', { text: '' })).toContain('text');
  });

  it('flags a malformed time', () => {
    expect(errorPaths('location', { name: 'X', time: '9am' })).toContain('time');
  });

  it('flags malformed coords', () => {
    expect(errorPaths('location', { name: 'X', coords: '200, 0' })).toContain('coords');
  });

  it('flags a non-positive / non-integer duration', () => {
    expect(errorPaths('activity', { name: 'X', duration: '1.5' })).toContain('duration');
  });

  it('flags malformed accommodation check-in time', () => {
    expect(errorPaths('accommodation', { name: 'X', checkIn: '25:00' })).toContain('checkIn');
  });
});
