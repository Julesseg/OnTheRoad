import type { Coords } from './coords';
import type { Trip } from './schema';
import type { RouteCache } from './route-cache';

/** A straight pairing of two consecutive located pins, keeping each end's date. */
export interface LegEndpoints {
  from: Coords;
  to: Coords;
  fromDate: string;
  toDate: string;
}

/** A leg ready to draw: road geometry when routed, the straight line when not. */
export interface ResolvedLeg {
  from: Coords;
  to: Coords;
  // The polyline to draw. The road geometry on a hit, otherwise the two
  // endpoints (the approximate straight-line fallback).
  coordinates: Coords[];
  // True when this is the straight-line fallback (offline or no drivable path),
  // so the map can style the leg as approximate (ADR-0009).
  approximate: boolean;
}

/** Routes one leg along real roads, or resolves null when it can't be routed. */
export type LegRouter = (from: Coords, to: Coords) => Promise<Coords[] | null>;

/**
 * The trip's legs in itinerary order: one between each consecutive pair of
 * located pins. Each leg carries its endpoints' dates so the day filter can dim
 * legs that aren't wholly on the active day, mirroring {@link tripRouteCoords}.
 */
export function tripLegs(trip: Trip): LegEndpoints[] {
  const pins: { coords: Coords; date: string }[] = [];
  for (const day of trip.days) {
    for (const item of day.items) {
      if (item.location?.lat != null && item.location?.lng != null) {
        pins.push({ coords: { lat: item.location.lat, lng: item.location.lng }, date: day.date });
      }
    }
  }
  const legs: LegEndpoints[] = [];
  for (let i = 0; i < pins.length - 1; i++) {
    legs.push({
      from: pins[i].coords,
      to: pins[i + 1].coords,
      fromDate: pins[i].date,
      toDate: pins[i + 1].date,
    });
  }
  return legs;
}

/**
 * Whether a leg is drawn at full accent (true) or dimmed (false): full when no
 * day filter is active, or when both endpoints fall on the active day. Off-day
 * legs are dimmed rather than hidden so the whole journey stays visible.
 */
export function legActive(
  leg: { fromDate: string; toDate: string },
  activeDate: string | undefined,
): boolean {
  return !activeDate || (leg.fromDate === activeDate && leg.toDate === activeDate);
}

/**
 * Resolve a single leg's geometry: serve the cache when warm (no network),
 * otherwise route it and cache the result. When routing fails — offline or no
 * drivable path — fall back to the approximate straight line and do NOT cache it,
 * so the leg is retried the next time routing is possible.
 */
export async function resolveLeg(
  from: Coords,
  to: Coords,
  router: LegRouter,
  cache: RouteCache,
): Promise<ResolvedLeg> {
  const cached = cache.get(from, to);
  if (cached) return { from, to, coordinates: cached, approximate: false };

  let road: Coords[] | null = null;
  try {
    road = await router(from, to);
  } catch {
    road = null;
  }
  if (road && road.length >= 2) {
    cache.set(from, to, road);
    return { from, to, coordinates: road, approximate: false };
  }
  return { from, to, coordinates: [from, to], approximate: true };
}

/**
 * Resolve legs in order. Awaiting each in turn keeps cache hits free and spaces
 * the network calls out, so MapKit's burst throttling isn't tripped by routing a
 * whole trip at once (ADR-0009).
 */
export async function resolveLegs(
  legs: { from: Coords; to: Coords }[],
  router: LegRouter,
  cache: RouteCache,
): Promise<ResolvedLeg[]> {
  const out: ResolvedLeg[] = [];
  for (const leg of legs) {
    out.push(await resolveLeg(leg.from, leg.to, router, cache));
  }
  return out;
}
