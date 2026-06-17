import { requireOptionalNativeModule } from 'expo';
import type { LegRouter } from './trip-legs';

// The native MKDirections module (modules/mk-directions) returns one leg's
// driving route as a JSON array of `[lat, lng]` pairs, or `[]` when MapKit finds
// no drivable path. It is registered under the name "MKDirections".
interface NativeMKDirectionsModule {
  routeLeg(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<string>;
}

/**
 * Route one leg along real roads via Apple's MKDirections (driving), the
 * {@link LegRouter} the map feeds to {@link resolveLeg} (ADR-0009). Resolves null
 * — the signal to fall back to a straight line — when the native module is
 * absent (Simulator / unsupported), when MapKit finds no drivable path, or when
 * the request fails (offline). No API key, no external host: MapKit is linked.
 */
export const routeLeg: LegRouter = async (from, to) => {
  const native = requireOptionalNativeModule<NativeMKDirectionsModule>('MKDirections');
  if (!native) return null;
  try {
    const pairs = JSON.parse(await native.routeLeg(from.lat, from.lng, to.lat, to.lng));
    if (!Array.isArray(pairs) || pairs.length < 2) return null;
    return pairs.map(([lat, lng]: [number, number]) => ({ lat, lng }));
  } catch {
    return null;
  }
};
