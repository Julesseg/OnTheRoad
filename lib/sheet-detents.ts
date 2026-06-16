// The /days sheet rests at three sizes: an XS peek that hands the map nearly the
// full screen, a medium half-sheet, and full. The home map frames the trip route
// into the area left visible above the sheet, so the fraction it subtracts is the
// sheet's current detent fraction (see CONTEXT.md#trip-route).
export const SHEET_DETENTS = [0.12, 0.5, 1.0] as const;

// The detent the sheet opens at — medium.
export const INITIAL_SHEET_DETENT_INDEX = 1;

/**
 * The fraction of the screen the day sheet covers at a given detent index, used
 * as the map's `panelFraction` so the route stays framed in the visible area.
 * An out-of-range index (should never happen — the index comes from the native
 * sheet) falls back to the medium resting fraction.
 */
export function panelFractionForDetent(index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= SHEET_DETENTS.length) {
    return SHEET_DETENTS[INITIAL_SHEET_DETENT_INDEX];
  }
  return SHEET_DETENTS[index];
}
