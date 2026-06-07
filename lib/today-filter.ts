import type { Day } from './schema';
import type { TripBadge } from './trip-badge';

export interface TodayFilterModel {
  canFilter: boolean;
  active: boolean;
}

export function todayFilterModel(
  days: Day[],
  badge: TripBadge,
  override: boolean | null,
  today: string,
): TodayFilterModel {
  const canFilter =
    badge.kind === 'now' && days.length > 1 && days.some((d) => d.date === today);
  return { canFilter, active: canFilter && (override ?? true) };
}
