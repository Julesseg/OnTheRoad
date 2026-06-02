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
 * The inline countdown pill shown on a trip card's date line, total over every
 * trip status: `"Now"` while in progress, `"in N <unit>"` before it starts, and
 * `"N <unit> ago"` once it has ended — the unit coarsens to weeks/months/years
 * so the count stays small (e.g. "in 2 months"). The trips list only renders
 * in-progress + upcoming, so the "ago" form is unused there but keeps the helper
 * safe to reuse for any trip.
 */
export function countdownPill(
  summary: Pick<TripSummary, 'startDate' | 'endDate'>,
  today: string,
): string {
  const badge = tripCountdownBadge(summary, today);
  if (badge.kind === 'now') return 'Now';
  const duration = approximateDuration(badge.days);
  const unit = durationUnitWord(duration);
  return badge.kind === 'before'
    ? `in ${duration.value} ${unit}`
    : `${duration.value} ${unit} ago`;
}

/**
 * The countdown pill text shown on the expanded title's `dates · pill` line:
 * "In progress" while the trip is happening, "Starts in N units" before it
 * begins, and "Ended N units ago" after it ends, with the day count coarsened
 * to the most legible unit.
 */
export function countdownPillLabel(badge: TripBadge): string {
  if (badge.kind === 'now') return 'In progress';
  const duration = approximateDuration(badge.days);
  const unit = durationUnitWord(duration);
  return badge.kind === 'before'
    ? `Starts in ${duration.value} ${unit}`
    : `Ended ${duration.value} ${unit} ago`;
}

const UNIT_ABBR: Record<DurationUnit, string> = { day: 'd', week: 'w', month: 'mo', year: 'y' };

/**
 * The shortened countdown pill for the collapsed inline title, where horizontal
 * room between the button groups is tight: "In progress", "in 6d", "3w ago".
 */
export function compactCountdownPillLabel(badge: TripBadge): string {
  if (badge.kind === 'now') return 'In progress';
  const duration = approximateDuration(badge.days);
  const abbr = `${duration.value}${UNIT_ABBR[duration.unit]}`;
  return badge.kind === 'before' ? `in ${abbr}` : `${abbr} ago`;
}
