import type { Item, Trip } from './schema';

/** Insert `item` at the end of `dayId`, or replace the existing item with the same id in place. Pure. */
export function upsertItemInTrip(trip: Trip, dayId: string, item: Item, now: string): Trip {
  return {
    ...trip,
    updatedAt: now,
    days: trip.days.map((day) => {
      if (day.id !== dayId) return day;
      const exists = day.items.some((i) => i.id === item.id);
      const items = exists
        ? day.items.map((i) => (i.id === item.id ? item : i))
        : [...day.items, item];
      return { ...day, items };
    }),
  };
}

/** Remove the item with `itemId` from `dayId`. Pure. */
export function deleteItemFromTrip(trip: Trip, dayId: string, itemId: string, now: string): Trip {
  return {
    ...trip,
    updatedAt: now,
    days: trip.days.map((day) =>
      day.id === dayId ? { ...day, items: day.items.filter((i) => i.id !== itemId) } : day,
    ),
  };
}
