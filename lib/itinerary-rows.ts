import type { Item, Trip } from './schema';
import { resolveNextUp } from './next-up';

export type ItineraryRow =
  | { kind: 'nextUp'; dayId: string; itemId: string }
  | { kind: 'dayHeader'; dayId: string; dayNumber: number; date: string; notes?: string }
  | { kind: 'item'; dayId: string; item: Item };

export function buildItineraryRows(trip: Trip, now: Date): ItineraryRow[] {
  const rows: ItineraryRow[] = [];

  const nextUp = resolveNextUp(trip, now);
  if (nextUp) {
    rows.push({ kind: 'nextUp', dayId: nextUp.dayId, itemId: nextUp.itemId });
  }

  const days = [...trip.days].sort((a, b) => a.date.localeCompare(b.date));
  days.forEach((day, index) => {
    rows.push({ kind: 'dayHeader', dayId: day.id, dayNumber: index + 1, date: day.date, notes: day.notes });
    for (const item of day.items) {
      rows.push({ kind: 'item', dayId: day.id, item });
    }
  });

  return rows;
}
