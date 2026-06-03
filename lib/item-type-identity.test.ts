import { describe, it, expect } from 'vitest';
import { ITEM_TYPE_IDENTITY, ITEM_TYPE_ORDER, itemTypeIdentity } from './item-type-identity';

describe('item-type identity', () => {
  it('maps each canonical type to its warm label, SF Symbol, and accent', () => {
    expect(itemTypeIdentity('location')).toEqual({
      label: 'Place',
      symbol: 'mappin.circle.fill',
      accent: '#E07A5F',
    });
    expect(itemTypeIdentity('accommodation')).toEqual({
      label: 'Stay',
      symbol: 'bed.double.fill',
      accent: '#5B5BD6',
    });
    expect(itemTypeIdentity('activity')).toEqual({
      label: 'Activity',
      symbol: 'figure.hiking',
      accent: '#3D9A5B',
    });
    expect(itemTypeIdentity('note')).toEqual({
      label: 'Note',
      symbol: 'note.text',
      accent: '#8A8580',
    });
  });

  it('orders the types location, accommodation, activity, note for the 2×2 grid', () => {
    expect(ITEM_TYPE_ORDER).toEqual(['location', 'accommodation', 'activity', 'note']);
  });

  it('keeps every accent clear of destructive-red and action-blue', () => {
    const reserved = ['#FF3B30', '#007AFF'];
    for (const type of ITEM_TYPE_ORDER) {
      expect(reserved).not.toContain(ITEM_TYPE_IDENTITY[type].accent.toUpperCase());
    }
  });
});
