import type { ItemType } from './item-form';

/** Per-Item-type visual identity: warm label, SF Symbol, and accent color. */
export interface ItemTypeIdentity {
  label: string;
  symbol: string;
  accent: string;
}

export const ITEM_TYPE_IDENTITY: Record<ItemType, ItemTypeIdentity> = {
  location: { label: 'Place', symbol: 'mappin.circle.fill', accent: '#E07A5F' },
  accommodation: { label: 'Stay', symbol: 'bed.double.fill', accent: '#5B5BD6' },
  activity: { label: 'Activity', symbol: 'figure.hiking', accent: '#3D9A5B' },
  note: { label: 'Note', symbol: 'note.text', accent: '#8A8580' },
};

/** Canonical type order for the 2×2 card-grid picker. */
export const ITEM_TYPE_ORDER: ItemType[] = ['location', 'accommodation', 'activity', 'note'];

export function itemTypeIdentity(type: ItemType): ItemTypeIdentity {
  return ITEM_TYPE_IDENTITY[type];
}
