import type { Coords } from './coords';
import { routeViewport, type Viewport } from './trip-route';

/**
 * Like `routeViewport` but shifts the camera centre south so that route pins
 * appear in the top (1 - panelFraction) portion of the screen, with the day
 * panel covering the bottom panelFraction. The shift is an approximation —
 * panelFraction/2 × 360/2^zoom degrees — and is not pixel-perfect across
 * varying zoom levels or screen sizes.
 */
export function framedViewport(coords: Coords[], panelFraction: number): Viewport {
  const base = routeViewport(coords);
  const latShift = (panelFraction / 2) * (360 / Math.pow(2, base.zoom));
  return {
    coordinates: {
      latitude: base.coordinates.latitude - latShift,
      longitude: base.coordinates.longitude,
    },
    zoom: base.zoom,
  };
}
