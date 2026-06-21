import type { TripSummary } from './schema';
import { daysBetween } from './today';
import { t, locale as resolvedLocale, type Locale } from './i18n';

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

const UNIT_KEY: Record<DurationUnit, 'unit.day' | 'unit.week' | 'unit.month' | 'unit.year'> = {
  day: 'unit.day',
  week: 'unit.week',
  month: 'unit.month',
  year: 'unit.year',
};

const UNIT_ABBR_KEY: Record<
  DurationUnit,
  'unitAbbr.day' | 'unitAbbr.week' | 'unitAbbr.month' | 'unitAbbr.year'
> = {
  day: 'unitAbbr.day',
  week: 'unitAbbr.week',
  month: 'unitAbbr.month',
  year: 'unitAbbr.year',
};

/** The localized, pluralised unit word for a duration: 1 → "day"/"jour", 3 → "days"/"jours". */
export function durationUnitWord(duration: Duration, loc: Locale = resolvedLocale): string {
  return t(UNIT_KEY[duration.unit], { count: duration.value }, loc);
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
  loc: Locale = resolvedLocale,
): string {
  const badge = tripCountdownBadge(summary, today);
  if (badge.kind === 'now') return t('countdown.now', undefined, loc);
  const duration = approximateDuration(badge.days);
  const params = { value: duration.value, unit: durationUnitWord(duration, loc) };
  return t(badge.kind === 'before' ? 'countdown.before' : 'countdown.after', params, loc);
}

/**
 * The countdown pill text shown on the expanded title's `dates · pill` line:
 * "In progress" while the trip is happening, "Starts in N units" before it
 * begins, and "Ended N units ago" after it ends, with the day count coarsened
 * to the most legible unit.
 */
export function countdownPillLabel(badge: TripBadge, loc: Locale = resolvedLocale): string {
  if (badge.kind === 'now') return t('countdown.inProgress', undefined, loc);
  const duration = approximateDuration(badge.days);
  const params = { value: duration.value, unit: durationUnitWord(duration, loc) };
  return t(badge.kind === 'before' ? 'countdown.startsIn' : 'countdown.endedAgo', params, loc);
}

/**
 * The shortened countdown pill for the collapsed inline title, where horizontal
 * room between the button groups is tight: "In progress", "in 6d", "3w ago".
 */
export function compactCountdownPillLabel(badge: TripBadge, loc: Locale = resolvedLocale): string {
  if (badge.kind === 'now') return t('countdown.inProgress', undefined, loc);
  const duration = approximateDuration(badge.days);
  const abbr = `${duration.value}${t(UNIT_ABBR_KEY[duration.unit], undefined, loc)}`;
  return t(badge.kind === 'before' ? 'countdown.compactBefore' : 'countdown.compactAfter', { abbr }, loc);
}
