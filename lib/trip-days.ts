import { newId } from './id';
import type { Day, Trip } from './schema';
import { localDateString } from './today';

/** The id of the Day on `date`'s local calendar date, or null if the trip has no such Day.
 * Uses the local Y-M-D of `date` so the picker's time component never shifts the day. */
export function dayIdForDate(trip: Trip, date: Date): string | null {
  const target = localDateString(date);
  return trip.days.find((d) => d.date === target)?.id ?? null;
}

/** Enumerate the inclusive YYYY-MM-DD dates from `start` through `end`, parsed
 * as local calendar dates so the sequence never drifts across UTC. */
export function datesInRange(start: string, end: string): string[] {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const current = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  const dates: string[] = [];
  while (current <= last) {
    dates.push(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(
        current.getDate(),
      ).padStart(2, '0')}`,
    );
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function reconcileDays(
  existingDays: Day[],
  startDate: string,
  endDate: string,
  makeId: () => string = newId,
): { days: Day[]; droppedDaysWithItems: Day[] } {
  // First existing day for each date wins, so an in-range date reuses its day
  // (id, items) rather than minting a fresh empty one.
  const byDate = new Map<string, Day>();
  for (const d of existingDays) {
    if (!byDate.has(d.date)) byDate.set(d.date, d);
  }
  const allDates = datesInRange(startDate, endDate);
  const inRange = new Set(allDates);
  const days = allDates.map(
    (date) => byDate.get(date) ?? { id: makeId(), date, items: [] },
  );
  // Days whose date no longer falls in range are dropped; flag any that still
  // hold items so the caller can warn before discarding them (items are never
  // auto-moved).
  const droppedDaysWithItems = existingDays.filter(
    (d) => !inRange.has(d.date) && d.items.length > 0,
  );
  return { days, droppedDaysWithItems };
}
