import type { TripSummary } from './schema';

export type ActivePartition = {
  inProgress: TripSummary[];
  upcoming: TripSummary[];
};

export type TripPartition = {
  active: ActivePartition;
  archived: TripSummary[];
};

export function partitionTrips(summaries: TripSummary[], today: string): TripPartition {
  const inProgress: TripSummary[] = [];
  const upcoming: TripSummary[] = [];
  const archived: TripSummary[] = [];

  for (const s of summaries) {
    if (s.endDate < today) {
      archived.push(s);
    } else if (s.startDate > today) {
      upcoming.push(s);
    } else {
      inProgress.push(s);
    }
  }

  const byStart = (a: TripSummary, b: TripSummary) => a.startDate.localeCompare(b.startDate);
  inProgress.sort(byStart);
  upcoming.sort(byStart);

  return { active: { inProgress, upcoming }, archived };
}
