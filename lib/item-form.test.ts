import { describe, it, expect } from 'vitest';
import { formToItem, itemToForm, emptyForm, itemFormSchema } from './item-form';
import type { Item } from './schema';

const ITEM_ID = '01900000-0000-7000-8000-000000000003';

describe('emptyForm', () => {
  it('returns default form values with category defaulting to activity', () => {
    const form = emptyForm();
    expect(form.name).toBe('');
    expect(form.category).toBe('activity');
    expect(form.time).toBe('');
    expect(form.notes).toBe('');
  });
});

describe('itemToForm', () => {
  it('maps an activity item to form values', () => {
    const item: Item = { id: ITEM_ID, name: 'Whale watching', category: 'activity', time: '10:00', notes: 'Book ahead' };
    const form = itemToForm(item);
    expect(form.name).toBe('Whale watching');
    expect(form.category).toBe('activity');
    expect(form.time).toBe('10:00');
    expect(form.notes).toBe('Book ahead');
  });

  it('maps a stay item (no time or notes) with empty strings for missing fields', () => {
    const item: Item = { id: ITEM_ID, name: 'Sea Cliff Inn', category: 'stay' };
    const form = itemToForm(item);
    expect(form.category).toBe('stay');
    expect(form.time).toBe('');
    expect(form.notes).toBe('');
  });

  it('maps a note item', () => {
    const item: Item = { id: ITEM_ID, name: 'Buy sunscreen', category: 'note' };
    const form = itemToForm(item);
    expect(form.name).toBe('Buy sunscreen');
    expect(form.category).toBe('note');
  });
});

describe('formToItem', () => {
  it('builds an activity item from form values', () => {
    const item = formToItem({ name: 'Hike', category: 'activity', time: '09:00', notes: '' }, ITEM_ID);
    expect(item).toEqual({ id: ITEM_ID, name: 'Hike', category: 'activity', time: '09:00' });
  });

  it('drops empty time and notes', () => {
    const item = formToItem({ name: 'Walk', category: 'location', time: '', notes: '' }, ITEM_ID);
    expect(item).toEqual({ id: ITEM_ID, name: 'Walk', category: 'location' });
    expect('time' in item).toBe(false);
    expect('notes' in item).toBe(false);
  });

  it('trims whitespace from name and notes', () => {
    const item = formToItem({ name: '  Café  ', category: 'meal', time: '', notes: '  Bring cash  ' }, ITEM_ID);
    expect(item.name).toBe('Café');
    expect(item.notes).toBe('Bring cash');
  });

  it('carries location and checklist from original item since the form does not surface them', () => {
    const original: Item = {
      id: ITEM_ID, name: 'Old name', category: 'location',
      location: { address: '1 Bridge Way', lat: 37.8, lng: -122.4 },
    };
    const edited = formToItem(itemToForm(original), ITEM_ID, original);
    expect(edited.location).toEqual({ address: '1 Bridge Way', lat: 37.8, lng: -122.4 });
  });
});

describe('itemToForm round-trips through formToItem', () => {
  const cases: Item[] = [
    { id: 'a', name: 'Pier walk', category: 'activity', time: '08:00', notes: 'early' },
    { id: 'b', name: 'Sea Cliff Inn', category: 'stay' },
    { id: 'c', name: 'Buy sunscreen', category: 'note' },
    { id: 'd', name: 'Golden Gate', category: 'location', time: '09:30' },
    { id: 'e', name: 'Taco truck', category: 'meal', notes: 'Cash only' },
  ];
  it.each(cases)('round-trips a $category item — $name', (original) => {
    const rebuilt = formToItem(itemToForm(original), original.id);
    expect(rebuilt).toEqual(original);
  });
});

describe('itemFormSchema validation', () => {
  it('accepts a valid form', () => {
    const result = itemFormSchema().safeParse({ name: 'Walk', category: 'activity', time: '09:00', notes: '' });
    expect(result.success).toBe(true);
  });

  it('flags a missing name', () => {
    const result = itemFormSchema().safeParse({ name: '   ', category: 'activity', time: '', notes: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((i) => i.path.join('.'))).toContain('name');
  });

  it('flags a malformed time', () => {
    const result = itemFormSchema().safeParse({ name: 'X', category: 'activity', time: '9am', notes: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((i) => i.path.join('.'))).toContain('time');
  });

  it('accepts an empty time (time is optional)', () => {
    const result = itemFormSchema().safeParse({ name: 'X', category: 'activity', time: '', notes: '' });
    expect(result.success).toBe(true);
  });
});
