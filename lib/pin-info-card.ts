import type { Trip } from './schema';
import type { Item } from './schema';

/** An item together with the day it lives on, enough to route to its full editor. */
export interface LocatedItem {
  item: Item;
  dayId: string;
}

/**
 * Look up the trip Item carrying a given marker id. Markers carry their item's id
 * (see CONTEXT.md#pin), so a tapped pin resolves back to its Item. Returns the day
 * too, since opening the full item editor — and toggling its checklist — is keyed
 * on `{ tripId, dayId, itemId }`.
 */
export function findLocatedItem(trip: Trip | null, id: string): LocatedItem | null {
  if (!trip) return null;
  for (const day of trip.days) {
    for (const item of day.items) {
      if (item.id === id) return { item, dayId: day.id };
    }
  }
  return null;
}
