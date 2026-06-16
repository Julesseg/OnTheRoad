import type { Coords } from './coords';
import { routeViewport, type Viewport } from './trip-route';

/**
 * The southward latitude shift that lifts a point into the top (1 - panelFraction)
 * portion of the screen, leaving the bottom panelFraction for the day sheet. The
 * shift is an approximation — panelFraction/2 × 360/2^zoom degrees — and is not
 * pixel-perfect across varying zoom levels or screen sizes.
 */
export function panelLatShift(zoom: number, panelFraction: number): number {
  return (panelFraction / 2) * (360 / Math.pow(2, zoom));
}

/**
 * Like `routeViewport` but shifts the camera centre south so that route pins
 * appear in the top (1 - panelFraction) portion of the screen, with the day
 * panel covering the bottom panelFraction.
 */
export function framedViewport(coords: Coords[], panelFraction: number): Viewport {
  const base = routeViewport(coords);
  return {
    coordinates: {
      latitude: base.coordinates.latitude - panelLatShift(base.zoom, panelFraction),
      longitude: base.coordinates.longitude,
    },
    zoom: base.zoom,
  };
}
