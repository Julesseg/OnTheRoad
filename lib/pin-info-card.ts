import type { Item, Trip } from './schema';
import { itemIdentity } from './item-identity';

/** An item together with the day it lives on, enough to route to its full editor. */
export interface LocatedItem {
  item: Item;
  dayId: string;
}

/**
 * Look up the trip Item carrying a given marker id. Markers carry their item's id
 * (see CONTEXT.md#pin), so a tapped pin resolves back to its Item. Returns the day
 * too, since opening the full item editor is keyed on `{ tripId, dayId, itemId }`.
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

/** The lightweight info-card projection of an Item shown when its pin is tapped. */
export interface PinInfoCardModel {
  id: string;
  name: string;
  accent: string;
  symbol: string;
  time?: string;
  notesSnippet?: string;
  hasLocation: boolean;
}

// A pin's info card is a glance, not the full notes — keep the snippet short.
const NOTES_SNIPPET_MAX = 120;

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function pinInfoCard(item: Item): PinInfoCardModel {
  const identity = itemIdentity(item.category);
  const notes = item.notes?.trim();
  return {
    id: item.id,
    name: item.name,
    accent: identity.accent,
    symbol: identity.symbol,
    time: item.time,
    notesSnippet: notes ? truncate(notes, NOTES_SNIPPET_MAX) : undefined,
    hasLocation: item.location?.lat != null && item.location?.lng != null,
  };
}
