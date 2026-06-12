import { describe, it, expect } from 'vitest';
import { itemIdentity, ITEM_IDENTITY } from './item-identity';
import type { ItemCategory } from './schema';
import { EmberPalette } from '@/constants/theme';

describe('item identity — v3 category-keyed', () => {
  it('maps each of the 5 categories to a label, SF Symbol, and accent', () => {
    const EXPECTED: Record<ItemCategory, { label: string; symbol: string; accent: string }> = {
      activity: { label: 'Activity', symbol: 'figure.hiking',       accent: EmberPalette.sage },
      location: { label: 'Place',    symbol: 'mappin.circle.fill',   accent: EmberPalette.olive },
      stay:     { label: 'Stay',     symbol: 'bed.double.fill',      accent: EmberPalette.steel },
      meal:     { label: 'Meal',     symbol: 'fork.knife.circle.fill', accent: EmberPalette.gold },
      note:     { label: 'Note',     symbol: 'note.text',            accent: EmberPalette.mauve },
    };
    for (const [cat, expected] of Object.entries(EXPECTED) as [ItemCategory, typeof EXPECTED[ItemCategory]][]) {
      const id = itemIdentity(cat);
      expect(id.label).toBe(expected.label);
      expect(id.symbol).toBe(expected.symbol);
      expect(id.accent).toBe(expected.accent);
    }
  });

  it('keeps every accent clear of interactive (coral) and destructive (rose) palette colours', () => {
    const reserved = new Set<string>([
      EmberPalette.coral,
      EmberPalette.coralLight,
      EmberPalette.rose,
      EmberPalette.roseLight,
    ]);
    const categories: ItemCategory[] = ['activity', 'location', 'stay', 'meal', 'note'];
    for (const cat of categories) {
      expect(reserved.has(ITEM_IDENTITY[cat].accent.toLowerCase())).toBe(false);
    }
  });
});
