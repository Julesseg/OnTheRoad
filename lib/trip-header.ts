import type { TripSummary } from './schema';
import { canFavorite, effectiveTripId, resolveActiveTrip } from './active-trip';

/**
 * What the Displayed Trip header should show, derived from the Displayed Trip,
 * the favorite, and the resolved default (see ADR-0001 / ADR-0002):
 *
 *   - `empty`    — no trips at all; only the Trips gateway is shown.
 *   - `home`     — the Displayed Trip is the resolved default; no back-arrow and
 *                  no star (you can't "favorite" or "leave" the trip you're on).
 *   - `browsing` — the Displayed Trip differs from the resolved default; the
 *                  back-arrow returns to the default, and the star appears when
 *                  the trip can still become the favorite (`canFavorite`).
 *
 * `tripId` is the effective Displayed Trip (an explicit selection when set and
 * still present, otherwise the resolved default).
 */
export type TripHeaderModel =
  | { mode: 'empty' }
  | {
      mode: 'home' | 'browsing';
      tripId: string;
      showBackArrow: boolean;
      showStar: boolean;
    };

export function tripHeaderModel(
  displayedTripId: string | null,
  summaries: TripSummary[],
  activeTripId: string | null,
  today: string,
): TripHeaderModel {
  const tripId = effectiveTripId(displayedTripId, summaries, activeTripId, today);
  if (tripId == null) return { mode: 'empty' };

  const summary = summaries.find((s) => s.id === tripId)!;
  const resolvedDefault = resolveActiveTrip(summaries, activeTripId, today).tripId;
  const browsing = tripId !== resolvedDefault;

  return {
    mode: browsing ? 'browsing' : 'home',
    tripId,
    showBackArrow: browsing,
    showStar: browsing && canFavorite(summary, today),
  };
}
