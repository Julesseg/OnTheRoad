import type { Trip } from './schema';
import { nextItemId } from './today';

export type NextUpTarget = { dayId: string; itemId: string } | null;

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function resolveNextUp(trip: Trip, now: Date): NextUpTarget {
  const today = localDateString(now);
  if (today < trip.startDate || today > trip.endDate) return null;
  const day = trip.days.find((d) => d.date === today);
  if (!day) return null;
  const itemId = nextItemId(day, now);
  if (!itemId) return null;
  return { dayId: day.id, itemId };
}
