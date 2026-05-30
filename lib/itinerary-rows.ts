import type { Item, Trip } from './schema';
import { resolveNextUp } from './next-up';
import { localDateString } from './today';

export type ItineraryRow =
  | { kind: 'nextUp'; dayId: string; itemId: string }
  | { kind: 'dayHeader'; dayId: string; dayNumber: number; date: string; isToday: boolean; notes?: string }
  | { kind: 'item'; dayId: string; item: Item };

export function buildItineraryRows(trip: Trip, now: Date): ItineraryRow[] {
  const rows: ItineraryRow[] = [];

  const nextUp = resolveNextUp(trip, now);
  if (nextUp) {
    rows.push({ kind: 'nextUp', dayId: nextUp.dayId, itemId: nextUp.itemId });
  }

  const today = localDateString(now);
  const days = [...trip.days].sort((a, b) => a.date.localeCompare(b.date));
  days.forEach((day, index) => {
    rows.push({
      kind: 'dayHeader',
      dayId: day.id,
      dayNumber: index + 1,
      date: day.date,
      isToday: day.date === today,
      notes: day.notes,
    });
    for (const item of day.items) {
      rows.push({ kind: 'item', dayId: day.id, item });
    }
  });

  return rows;
}

// Index of a Day's header row within the built row list, for scrolling the
// itinerary to that Day (e.g. when the Next-up card is tapped). -1 if absent.
export function dayHeaderIndex(rows: ItineraryRow[], dayId: string): number {
  return rows.findIndex((r) => r.kind === 'dayHeader' && r.dayId === dayId);
}
