import { describe, it, expect } from 'vitest';
import { itemIdentity, ITEM_IDENTITY } from './item-identity';
import type { ItemCategory } from './schema';

describe('item identity — v3 category-keyed', () => {
  it('maps each of the 5 categories to a label, SF Symbol, and accent', () => {
    const EXPECTED: Record<ItemCategory, { label: string; symbol: string; accent: string }> = {
      activity: { label: 'Activity', symbol: 'figure.hiking',       accent: '#3D9A5B' },
      location: { label: 'Place',    symbol: 'mappin.circle.fill',   accent: '#E07A5F' },
      stay:     { label: 'Stay',     symbol: 'bed.double.fill',      accent: '#5B5BD6' },
      meal:     { label: 'Meal',     symbol: 'fork.knife.circle.fill', accent: '#C4813A' },
      note:     { label: 'Note',     symbol: 'note.text',            accent: '#8A8580' },
    };
    for (const [cat, expected] of Object.entries(EXPECTED) as [ItemCategory, typeof EXPECTED[ItemCategory]][]) {
      const id = itemIdentity(cat);
      expect(id.label).toBe(expected.label);
      expect(id.symbol).toBe(expected.symbol);
      expect(id.accent).toBe(expected.accent);
    }
  });

  it('keeps every accent clear of destructive-red and action-blue', () => {
    const reserved = new Set(['#FF3B30', '#007AFF']);
    const categories: ItemCategory[] = ['activity', 'location', 'stay', 'meal', 'note'];
    for (const cat of categories) {
      expect(reserved.has(ITEM_IDENTITY[cat].accent.toUpperCase())).toBe(false);
    }
  });
});
