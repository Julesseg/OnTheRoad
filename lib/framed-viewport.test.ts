import { describe, it, expect } from 'vitest';
import { framedViewport } from './framed-viewport';
import { routeViewport } from './trip-route';
import type { Coords } from './coords';

describe('framedViewport', () => {
  it('returns the same viewport as routeViewport when panelFraction is 0', () => {
    const coords: Coords[] = [{ lat: 37.8, lng: -122.4 }];
    expect(framedViewport(coords, 0)).toEqual(routeViewport(coords));
  });

  it('shifts the camera centre south (lower latitude) when panelFraction is positive', () => {
    const coords: Coords[] = [{ lat: 37.8, lng: -122.4 }];
    const base = routeViewport(coords);
    const framed = framedViewport(coords, 0.67);
    expect(framed.coordinates.latitude).toBeLessThan(base.coordinates.latitude);
  });

  it('does not change the zoom or longitude', () => {
    const coords: Coords[] = [{ lat: 37.8, lng: -122.4 }];
    const base = routeViewport(coords);
    const framed = framedViewport(coords, 0.67);
    expect(framed.zoom).toBe(base.zoom);
    expect(framed.coordinates.longitude).toBe(base.coordinates.longitude);
  });

  it('shifts by panelFraction/2 × 360/2^zoom degrees south', () => {
    const coords: Coords[] = [{ lat: 41, lng: -115 }];
    const panelFraction = 0.5;
    const base = routeViewport(coords);
    const framed = framedViewport(coords, panelFraction);
    const expectedShift = (panelFraction / 2) * (360 / Math.pow(2, base.zoom));
    expect(framed.coordinates.latitude).toBeCloseTo(
      base.coordinates.latitude - expectedShift,
      5,
    );
  });

  it('keeps zoom=1 for an empty coords list', () => {
    const framed = framedViewport([], 0.67);
    expect(framed.zoom).toBe(1);
    expect(framed.coordinates.longitude).toBe(0);
  });

  it('works with a multi-coord span (PCH route)', () => {
    const coords: Coords[] = [
      { lat: 37.8199, lng: -122.4783 },
      { lat: 36.2704, lng: -121.8081 },
      { lat: 35.6852, lng: -121.1685 },
    ];
    const base = routeViewport(coords);
    const framed = framedViewport(coords, 0.67);
    expect(framed.coordinates.latitude).toBeLessThan(base.coordinates.latitude);
    expect(framed.zoom).toBe(base.zoom);
  });
});
