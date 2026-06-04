import type { SFSymbol } from 'sf-symbols-typescript';
import type { ItemType } from './item-form';

/**
 * The fixed visual identity of an Item type — its warm display label, SF Symbol,
 * and accent color (see CONTEXT.md#item and ADR-0003). This is the single source
 * of truth reused by the item editor's section header and the add-item picker, so
 * a type's symbol/accent are defined in exactly one place.
 *
 * Accents stay clear of destructive-red (`#FF3B30`) and action-blue (`#007AFF`).
 */
export interface ItemIdentity {
  type: ItemType;
  label: string;
  symbol: SFSymbol;
  accent: string;
}

export const ITEM_IDENTITY: Record<ItemType, ItemIdentity> = {
  location: { type: 'location', label: 'Place', symbol: 'mappin.circle.fill', accent: '#E07A5F' },
  accommodation: { type: 'accommodation', label: 'Stay', symbol: 'bed.double.fill', accent: '#5B5BD6' },
  activity: { type: 'activity', label: 'Activity', symbol: 'figure.hiking', accent: '#3D9A5B' },
  note: { type: 'note', label: 'Note', symbol: 'note.text', accent: '#8A8580' },
};

export function itemIdentity(type: ItemType): ItemIdentity {
  return ITEM_IDENTITY[type];
}
