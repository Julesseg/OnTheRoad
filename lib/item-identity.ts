import type { SFSymbol } from 'sf-symbols-typescript';
import { EmberPalette } from '@/constants/theme';
import type { ItemCategory } from './schema';

/**
 * The fixed visual identity of an Item category — its warm display label, SF Symbol,
 * and accent color (see CONTEXT.md#item, ADR-0004, ADR-0005). Single source of truth
 * reused by the item editor header and the add-item picker.
 *
 * Accents are drawn from the Ember ramp and stay clear of the interactive (coral)
 * and destructive (rose) colours.
 */
export interface ItemIdentity {
  category: ItemCategory;
  label: string;
  symbol: SFSymbol;
  accent: string;
}

export const ITEM_IDENTITY: Record<ItemCategory, ItemIdentity> = {
  activity: { category: 'activity', label: 'Activity', symbol: 'figure.hiking',        accent: EmberPalette.sage },
  location: { category: 'location', label: 'Place',    symbol: 'mappin.circle.fill',    accent: EmberPalette.olive },
  stay:     { category: 'stay',     label: 'Stay',     symbol: 'bed.double.fill',       accent: EmberPalette.steel },
  meal:     { category: 'meal',     label: 'Meal',     symbol: 'fork.knife.circle.fill', accent: EmberPalette.gold },
  note:     { category: 'note',     label: 'Note',     symbol: 'note.text',             accent: EmberPalette.mauve },
};

export function itemIdentity(category: ItemCategory): ItemIdentity {
  return ITEM_IDENTITY[category];
}
