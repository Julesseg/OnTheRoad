import type { TripSummary } from './schema';
import { t, locale as resolvedLocale, type Locale } from './i18n';

export function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * A trip's position relative to today, as a **stable kind** — never the
 * displayed words. The on-screen label is resolved separately through
 * {@link tripStatusLabel}, so localized text ("In progress" / "En cours") never
 * feeds back into logic or comparisons.
 */
export type TripStatusKind = 'in-progress' | 'upcoming' | 'past';

export function tripStatus(trip: TripSummary): TripStatusKind {
  const today = todayString();
  if (trip.endDate < today) return 'past';
  if (trip.startDate > today) return 'upcoming';
  return 'in-progress';
}

const STATUS_KEY: Record<TripStatusKind, 'status.inProgress' | 'status.upcoming' | 'status.past'> =
  {
    'in-progress': 'status.inProgress',
    upcoming: 'status.upcoming',
    past: 'status.past',
  };

/** The localized badge label for a {@link TripStatusKind}, resolved at render time. */
export function tripStatusLabel(kind: TripStatusKind, loc: Locale = resolvedLocale): string {
  return t(STATUS_KEY[kind], undefined, loc);
}

// A fixed region per UI language so dates always match the on-screen language
// and output stays deterministic for tests (en → en-US, fr → fr-FR).
const REGION: Record<Locale, string> = { en: 'en-US', fr: 'fr-FR' };

/** Format a YYYY-MM-DD date for display, e.g. "Mon, Jun 15" / "lun. 15 juin".
 * Parses the Y-M-D parts as local time so the rendered weekday never drifts
 * across UTC. Formats in the UI language, defaulting to the resolved locale. */
export function formatDayLabel(date: string, loc: Locale = resolvedLocale): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(REGION[loc], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a YYYY-MM-DD start/end pair as a natural date range in the UI
 * language, collapsing shared month/year so they aren't repeated:
 *   en  same month → "Jun 1 – 15, 2026"   ·  fr → "1 – 15 juin 2026"
 *   en  same year  → "Jun 28 – Jul 3, 2026" · fr → "28 juin – 3 juil. 2026"
 *   en  otherwise  → "Dec 30, 2026 – Jan 2, 2027" · fr → "30 déc. 2026 – 2 janv. 2027"
 * French puts the day before the month, so the two languages assemble the
 * collapsed range differently. Parses the Y-M-D parts as local time so days
 * never drift across UTC.
 */
export function formatDateRange(start: string, end: string, loc: Locale = resolvedLocale): string {
  const region = REGION[loc];
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const month = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d).toLocaleDateString(region, { month: 'short' });

  if (loc === 'fr') {
    if (sy === ey && sm === em) return `${sd} – ${ed} ${month(sy, sm, sd)} ${ey}`;
    if (sy === ey) return `${sd} ${month(sy, sm, sd)} – ${ed} ${month(ey, em, ed)} ${ey}`;
    return `${sd} ${month(sy, sm, sd)} ${sy} – ${ed} ${month(ey, em, ed)} ${ey}`;
  }

  const monthDay = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d).toLocaleDateString(region, { month: 'short', day: 'numeric' });
  if (sy === ey && sm === em) return `${monthDay(sy, sm, sd)} – ${ed}, ${ey}`;
  if (sy === ey) return `${monthDay(sy, sm, sd)} – ${monthDay(ey, em, ed)}, ${ey}`;
  return `${monthDay(sy, sm, sd)}, ${sy} – ${monthDay(ey, em, ed)}, ${ey}`;
}
