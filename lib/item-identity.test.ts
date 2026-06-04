import { describe, it, expect } from 'vitest';
import { itemIdentity, ITEM_IDENTITY } from './item-identity';
import type { ItemType } from './item-form';

describe('item identity', () => {
  it('maps each type to its warm label, SF Symbol, and accent', () => {
    expect(itemIdentity('location')).toEqual({
      type: 'location',
      label: 'Place',
      symbol: 'mappin.circle.fill',
      accent: '#E07A5F',
    });
    expect(itemIdentity('accommodation')).toEqual({
      type: 'accommodation',
      label: 'Stay',
      symbol: 'bed.double.fill',
      accent: '#5B5BD6',
    });
    expect(itemIdentity('activity')).toEqual({
      type: 'activity',
      label: 'Activity',
      symbol: 'figure.hiking',
      accent: '#3D9A5B',
    });
    expect(itemIdentity('note')).toEqual({
      type: 'note',
      label: 'Note',
      symbol: 'note.text',
      accent: '#8A8580',
    });
  });

  it('keeps every accent clear of destructive-red and action-blue', () => {
    const reserved = new Set(['#FF3B30', '#007AFF']);
    const types: ItemType[] = ['location', 'accommodation', 'activity', 'note'];
    for (const t of types) {
      expect(reserved.has(ITEM_IDENTITY[t].accent.toUpperCase())).toBe(false);
    }
  });
});
