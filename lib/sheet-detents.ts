// The /days sheet rests at three sizes: an XS peek that hands the map nearly the
// full screen, a medium half-sheet, and full. The home map frames the trip route
// into the area left visible above the sheet, so the fraction it subtracts is the
// sheet's current detent fraction (see CONTEXT.md#trip-route).
export const SHEET_DETENTS = [0.12, 0.5, 1.0] as const;

// The detent the sheet opens at — medium.
export const INITIAL_SHEET_DETENT_INDEX = 1;

// The smallest (XS peek) detent — where a tapped pin's info card is shown.
export const MIN_SHEET_DETENT_INDEX = 0;

/**
 * The fraction of the screen the day sheet effectively subtracts from the framed
 * map at a given detent. For XS and medium this is the sheet's own size, so the
 * route stays framed in the area above it. At the full detent the map is entirely
 * behind the sheet, so there's nothing to frame into — centre the route in the
 * screen (fraction 0) so it's centred once the sheet collapses. An out-of-range
 * index (should never happen — it comes from the native sheet) falls back to the
 * medium resting fraction.
 */
export function panelFractionForDetent(index: number): number {
  const safe =
    !Number.isInteger(index) || index < 0 || index >= SHEET_DETENTS.length
      ? INITIAL_SHEET_DETENT_INDEX
      : index;
  if (safe === SHEET_DETENTS.length - 1) return 0;
  return SHEET_DETENTS[safe];
}
