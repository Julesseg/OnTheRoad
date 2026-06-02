import type { TripSummary } from './schema';
import { daysBetween } from './today';

/**
 * The countdown badge shown beside a trip's title:
 *   - `now`    — the trip is in progress today
 *   - `before` — the trip is upcoming; `days` until it starts ("in N days")
 *   - `after`  — the trip has ended; `days` since it ended ("N days ago")
 */
export type TripBadge =
  | { kind: 'now' }
  | { kind: 'before'; days: number }
  | { kind: 'after'; days: number };

export function tripCountdownBadge(
  summary: Pick<TripSummary, 'startDate' | 'endDate'>,
  today: string,
): TripBadge {
  if (summary.endDate < today) return { kind: 'after', days: daysBetween(summary.endDate, today) };
  if (summary.startDate > today) return { kind: 'before', days: daysBetween(today, summary.startDate) };
  return { kind: 'now' };
}

export type DurationUnit = 'day' | 'week' | 'month' | 'year';
export interface Duration {
  value: number;
  unit: DurationUnit;
}

/**
 * Collapse a raw day count into the coarsest natural unit so the countdown badge
 * stays legible: days under a week, then weeks, then months, then years. Values
 * are rounded to the nearest whole unit (e.g. 20 days → "3 weeks").
 */
export function approximateDuration(days: number): Duration {
  if (days < 7) return { value: days, unit: 'day' };
  if (days < 30) return { value: Math.round(days / 7), unit: 'week' };
  if (days < 365) return { value: Math.round(days / 30), unit: 'month' };
  return { value: Math.round(days / 365), unit: 'year' };
}

/** The unit word for a duration, pluralised: 1 → "day", 3 → "days". */
export function durationUnitWord(duration: Duration): string {
  return duration.value === 1 ? duration.unit : `${duration.unit}s`;
}

/**
 * The inline countdown pill shown on a trip card's date line: `"Now"` while the
 * trip is in progress and `"in N <unit>"` (coarsened to weeks/months/years)
 * before it starts. The trips list only renders in-progress + upcoming trips, so
 * an ended ("after") trip is out of contract and throws rather than silently
 * mislabelling itself as `"Now"`.
 */
export function countdownPill(
  summary: Pick<TripSummary, 'startDate' | 'endDate'>,
  today: string,
): string {
  const badge = tripCountdownBadge(summary, today);
  if (badge.kind === 'after') {
    throw new Error('countdownPill: trip has already ended (in-progress or upcoming only)');
  }
  if (badge.kind === 'now') return 'Now';
  const duration = approximateDuration(badge.days);
  return `in ${duration.value} ${durationUnitWord(duration)}`;
}
