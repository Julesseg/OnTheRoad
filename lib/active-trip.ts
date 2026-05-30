import type { TripSummary } from './schema';

export interface ResolutionResult {
  tripId: string | null;
  shouldClearFavorite: boolean;
}

export function canFavorite(summary: TripSummary, today: string): boolean {
  return summary.endDate >= today;
}

function selectCurrentOrNext(summaries: TripSummary[], today: string): string | null {
  return (
    summaries
      .filter((s) => s.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]?.id ?? null
  );
}

export function resolveActiveTrip(
  summaries: TripSummary[],
  activeTripId: string | null,
  today: string,
): ResolutionResult {
  if (activeTripId != null) {
    const favorite = summaries.find((s) => s.id === activeTripId);
    if (favorite && canFavorite(favorite, today)) {
      return { tripId: activeTripId, shouldClearFavorite: false };
    }
    return { tripId: selectCurrentOrNext(summaries, today), shouldClearFavorite: true };
  }
  return { tripId: selectCurrentOrNext(summaries, today), shouldClearFavorite: false };
}
