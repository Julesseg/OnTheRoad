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

/** Move the item at `from` to index `to` within `dayId`'s items. Pure. */
export function reorderDayItems(
  trip: Trip,
  dayId: string,
  from: number,
  to: number,
  now: string,
): Trip {
  return {
    ...trip,
    updatedAt: now,
    days: trip.days.map((day) => {
      if (day.id !== dayId) return day;
      const items = [...day.items];
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return { ...day, items };
    }),
  };
}

/** Move `itemId` out of `fromDayId` and append it to the end of `toDayId`. Pure.
 * No-op if the item isn't in the source day, or if `toDayId` isn't in the trip
 * (avoids silently dropping the item). */
export function moveItemToDay(
  trip: Trip,
  fromDayId: string,
  toDayId: string,
  itemId: string,
  now: string,
): Trip {
  if (!trip.days.some((d) => d.id === toDayId)) return trip;
  const item = trip.days
    .find((d) => d.id === fromDayId)
    ?.items.find((i) => i.id === itemId);
  if (!item) return trip;
  return {
    ...trip,
    updatedAt: now,
    days: trip.days.map((day) => {
      if (day.id === fromDayId) {
        return { ...day, items: day.items.filter((i) => i.id !== itemId) };
      }
      if (day.id === toDayId) {
        return { ...day, items: [...day.items, item] };
      }
      return day;
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
