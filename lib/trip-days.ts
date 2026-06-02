import type { Trip } from './schema';
import { localDateString } from './today';

/** The id of the Day on `date`'s local calendar date, or null if the trip has no such Day.
 * Uses the local Y-M-D of `date` so the picker's time component never shifts the day. */
export function dayIdForDate(trip: Trip, date: Date): string | null {
  const target = localDateString(date);
  return trip.days.find((d) => d.date === target)?.id ?? null;
}
