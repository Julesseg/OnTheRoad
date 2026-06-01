import type { Day, Trip } from './schema';
import { itemTime, sortItemsByTime } from './item-display';

export type TodayKind = 'today' | 'before' | 'after';

export interface TodaySelection {
  kind: TodayKind;
  day?: Day;
  daysAway?: number;
}

export function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * The item to spotlight in the at-a-glance "today" view. Considering items in
 * chronological order, the earliest whose time is at or after `now`; if no item
 * carries a time at all, the first item. Returns null when the day is empty or
 * when every timed item has already passed.
 */
export function nextItemId(day: Day, now: Date): string | null {
  const nowTime = localTimeString(now);
  const items = sortItemsByTime(day.items);
  const hasTimed = items.some((i) => itemTime(i) != null);
  if (hasTimed) {
    const next = items.find((i) => {
      const t = itemTime(i);
      return t != null && t >= nowTime;
    });
    return next?.id ?? null;
  }
  return items[0]?.id ?? null;
}

export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

type DatedTrip = Pick<Trip, 'startDate' | 'endDate' | 'days'>;

function sortedDays(trip: DatedTrip): Day[] {
  return [...trip.days].sort((a, b) => a.date.localeCompare(b.date));
}

export function selectTodayDay(trip: DatedTrip, now: Date): TodaySelection {
  const today = localDateString(now);
  if (today < trip.startDate) {
    const days = sortedDays(trip);
    return { kind: 'before', day: days[0], daysAway: daysBetween(today, trip.startDate) };
  }
  if (today > trip.endDate) {
    const days = sortedDays(trip);
    return { kind: 'after', day: days[days.length - 1] };
  }
  const day = trip.days.find((d) => d.date === today);
  return { kind: 'today', day, daysAway: 0 };
}
