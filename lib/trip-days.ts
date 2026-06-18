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

/** The two lossless modes for re-dating an existing trip (see ADR-0013 and the
 * Shift / Adjust glossary entry). A date edit never deletes an Item. */
export type DateEditMode = 'shift' | 'adjust';

const byDateAsc = (a: Day, b: Day) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/**
 * Re-date a trip's days to a new span without ever dropping an Item.
 *
 * **shift** — the caller has locked the duration (picking only a new start), so
 * the nth day by date order takes the nth new date, keeping its id, items, and
 * ordinal position (Day 1 stays Day 1). Bijective: nothing overflows or empties.
 *
 * **adjust** — a date-anchored reconcile. A date still in the window reuses its
 * existing day (id + items); a newly in-window date becomes an empty day. Items
 * on days that now fall outside are carried to the nearest surviving edge —
 * before the new start onto the first day, after the new end onto the last day,
 * in ascending-date order and after that edge day's own items.
 *
 * Defaults to **adjust** (the date-anchored behaviour trip creation relies on).
 */
export function reconcileDays(
  existingDays: Day[],
  startDate: string,
  endDate: string,
  mode: DateEditMode = 'adjust',
  makeId: () => string = newId,
): Day[] {
  const allDates = datesInRange(startDate, endDate);

  if (mode === 'shift') {
    const sorted = [...existingDays].sort(byDateAsc);
    return allDates.map((date, i) =>
      sorted[i] ? { ...sorted[i], date } : { id: makeId(), date, items: [] },
    );
  }

  // First existing day for each in-window date wins, so an in-window date reuses
  // its day (id, items) rather than minting a fresh empty one. Reused days are
  // cloned (items copied) so edge overflow never mutates the input.
  const byDate = new Map<string, Day>();
  for (const d of existingDays) {
    if (!byDate.has(d.date)) byDate.set(d.date, d);
  }
  const days = allDates.map((date) => {
    const existing = byDate.get(date);
    return existing
      ? { ...existing, items: [...existing.items] }
      : { id: makeId(), date, items: [] };
  });

  // Items on days that fell out of the window are carried to the nearest edge,
  // in ascending date order, after that edge day's own items — never dropped.
  const before = existingDays.filter((d) => d.date < startDate).sort(byDateAsc);
  const after = existingDays.filter((d) => d.date > endDate).sort(byDateAsc);
  const beforeItems = before.flatMap((d) => d.items);
  const afterItems = after.flatMap((d) => d.items);
  if (beforeItems.length > 0) days[0].items.push(...beforeItems);
  if (afterItems.length > 0) days[days.length - 1].items.push(...afterItems);

  return days;
}
