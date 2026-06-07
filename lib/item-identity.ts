import type { SFSymbol } from 'sf-symbols-typescript';
import type { ItemCategory } from './schema';

/**
 * The fixed visual identity of an Item category — its warm display label, SF Symbol,
 * and accent color (see CONTEXT.md#item and ADR-0004). Single source of truth reused
 * by the item editor header and the add-item picker.
 *
 * Accents stay clear of destructive-red (#FF3B30) and action-blue (#007AFF).
 */
export interface ItemIdentity {
  category: ItemCategory;
  label: string;
  symbol: SFSymbol;
  accent: string;
}

export const ITEM_IDENTITY: Record<ItemCategory, ItemIdentity> = {
  activity: { category: 'activity', label: 'Activity', symbol: 'figure.hiking',        accent: '#3D9A5B' },
  location: { category: 'location', label: 'Place',    symbol: 'mappin.circle.fill',    accent: '#E07A5F' },
  stay:     { category: 'stay',     label: 'Stay',     symbol: 'bed.double.fill',       accent: '#5B5BD6' },
  meal:     { category: 'meal',     label: 'Meal',     symbol: 'fork.knife.circle.fill', accent: '#C4813A' },
  note:     { category: 'note',     label: 'Note',     symbol: 'note.text',             accent: '#8A8580' },
};

export function itemIdentity(category: ItemCategory): ItemIdentity {
  return ITEM_IDENTITY[category];
}
