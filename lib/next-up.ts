import type { Trip } from './schema';
import { itemTime } from './item-display';
import { localDateString, nextItemId } from './today';

export type NextUpTarget = { dayId: string; itemId: string } | null;

export function resolveNextUp(trip: Trip, now: Date): NextUpTarget {
  const today = localDateString(now);
  if (today < trip.startDate || today > trip.endDate) return null;
  const day = trip.days.find((d) => d.date === today);
  if (!day) return null;
  const itemId = nextItemId(day, now);
  if (!itemId) return null;
  const item = day.items.find((i) => i.id === itemId);
  if (!item || itemTime(item) == null) return null;
  return { dayId: day.id, itemId };
}
