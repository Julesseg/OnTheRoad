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
