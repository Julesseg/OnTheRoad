import type { TripSummary } from './schema';

export function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function tripStatus(trip: TripSummary): 'In progress' | 'Upcoming' | 'Past' {
  const today = todayString();
  if (trip.endDate < today) return 'Past';
  if (trip.startDate > today) return 'Upcoming';
  return 'In progress';
}

/** Format a YYYY-MM-DD date for display, e.g. "Mon, Jun 15". Parses the
 * Y-M-D parts as local time so the rendered weekday never drifts across UTC. */
export function formatDayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
