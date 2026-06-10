import type { Day } from './schema';
import type { TripBadge } from './trip-badge';

/**
 * - `null` — default: today is filtered when eligible.
 * - `true` — today (same as default, but explicit).
 * - `false` — explicitly off, show all days.
 * - `'YYYY-MM-DD'` — filter that specific day (any trip, via day-header tap).
 */
export type DayFilterOverride = string | boolean | null;

export interface TodayFilterModel {
  canFilter: boolean;
  active: boolean;
  activeDate: string | null;
}

export function todayFilterModel(
  days: Day[],
  badge: TripBadge,
  override: DayFilterOverride,
  today: string,
): TodayFilterModel {
  const canFilter =
    badge.kind === 'now' && days.length > 1 && days.some((d) => d.date === today);
  let activeDate: string | null = null;
  if (typeof override === 'string') {
    activeDate = days.some((d) => d.date === override) ? override : null;
  } else if (override !== false) {
    // null (default) and true both mean "today", gated on eligibility.
    activeDate = canFilter ? today : null;
  }
  return { canFilter, active: activeDate != null, activeDate };
}
