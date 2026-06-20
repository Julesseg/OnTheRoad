import type { ComponentProps } from 'react';
import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { SFSymbol } from 'sf-symbols-typescript';
import { EmberPalette } from '@/constants/theme';
import type { ItemCategory } from './schema';

export type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * The fixed visual identity of an Item category — its warm display label, SF Symbol,
 * and accent color (see CONTEXT.md#item, ADR-0004, ADR-0005). Single source of truth
 * reused by the item editor header and the add-item picker.
 *
 * Accents are drawn from the Ember ramp and stay clear of the interactive (coral)
 * and destructive (rose) colours. Steel deliberately overlaps the secondaryAction
 * role: category accents render in the item editor, secondary actions on list
 * swipes, so they never co-occur — an accepted seam per ADR-0005 (Consequences).
 */
export interface ItemIdentity {
  category: ItemCategory;
  label: string;
  // The SF Symbol drives the iOS render; materialSymbol is its Material Icons
  // parallel for the Android port, so each platform shows a native-idiom glyph
  // for the same category (ADR-0015). Keep the pair in sync.
  symbol: SFSymbol;
  materialSymbol: MaterialIconName;
  accent: string;
}

export const ITEM_IDENTITY: Record<ItemCategory, ItemIdentity> = {
  activity: { category: 'activity', label: 'Activity', symbol: 'figure.hiking',  materialSymbol: 'hiking',        accent: EmberPalette.sage },
  location: { category: 'location', label: 'Place',    symbol: 'mappin',          materialSymbol: 'place',         accent: EmberPalette.olive },
  stay:     { category: 'stay',     label: 'Stay',     symbol: 'bed.double.fill', materialSymbol: 'hotel',         accent: EmberPalette.steel },
  meal:     { category: 'meal',     label: 'Meal',     symbol: 'fork.knife',      materialSymbol: 'restaurant',    accent: EmberPalette.gold },
  note:     { category: 'note',     label: 'Note',     symbol: 'note.text',       materialSymbol: 'sticky-note-2', accent: EmberPalette.mauve },
};

export function itemIdentity(category: ItemCategory): ItemIdentity {
  return ITEM_IDENTITY[category];
}
