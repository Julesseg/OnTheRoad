import type { ItemType } from './item-form';

/**
 * The fixed visual identity of an Item type — its warm user-facing label, SF
 * Symbol, and accent color. This is the single source of truth reused by the
 * type picker, item rows, and form accents (see CONTEXT.md#item and ADR-0003).
 * Code, schema, and params keep the canonical type names; only the `label` here
 * is the user-facing wording (Place / Stay / Activity / Note).
 *
 * Accents are deliberately clear of destructive-red (#FF3B30) and action-blue
 * (#007AFF) so a type's color never reads as "delete" or "system action".
 */
export interface ItemTypeIdentity {
  /** Warm user-facing label shown on cards and row headers. */
  label: string;
  /** SF Symbol name rendered in the type's accent color. */
  symbol: string;
  /** Accent color (hex), distinct from the reserved system colors. */
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
