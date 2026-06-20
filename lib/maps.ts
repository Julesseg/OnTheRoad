import { Linking, Platform } from 'react-native';

import type { MapsApp } from './schema';

export type MapsTarget = {
  coords?: { lat: number; lng: number };
  address?: string;
};

export const MAPS_APP_LABELS: Record<MapsApp, string> = {
  apple: 'Apple Maps',
  google: 'Google Maps',
  waze: 'Waze',
};

function daddrParam(target: MapsTarget): string {
  if (target.coords) {
    return `${target.coords.lat},${target.coords.lng}`;
  }
  return encodeURIComponent(target.address ?? '');
}

export function buildAppleMapsUrl(target: MapsTarget): string {
  return `maps://?daddr=${daddrParam(target)}`;
}

export function buildGoogleMapsUrl(target: MapsTarget): string {
  // iOS opens the Google Maps app via its comgooglemaps:// scheme. Android's
  // Google Maps does not register that scheme; the universal maps URL opens the
  // app when installed and the browser otherwise (ADR-0015).
  if (Platform.OS === 'android') {
    return `https://www.google.com/maps/dir/?api=1&destination=${daddrParam(target)}`;
  }
  return `comgooglemaps://?daddr=${daddrParam(target)}`;
}

export function buildWazeMapsUrl(target: MapsTarget): string {
  if (target.coords) {
    return `waze://?ll=${target.coords.lat},${target.coords.lng}&navigate=yes`;
  }
  return `waze://?q=${encodeURIComponent(target.address ?? '')}&navigate=yes`;
}

const URL_BUILDERS: Record<MapsApp, (target: MapsTarget) => string> = {
  apple: buildAppleMapsUrl,
  google: buildGoogleMapsUrl,
  waze: buildWazeMapsUrl,
};

// Apple Maps ships with iOS, so it's always available; the others must be probed.
const PROBE_SCHEME: Partial<Record<MapsApp, string>> = {
  google: 'comgooglemaps://',
  waze: 'waze://',
};

export function openInMaps(target: MapsTarget, options: { app: MapsApp }): Promise<void> {
  return Linking.openURL(URL_BUILDERS[options.app](target));
}

export async function getInstalledMapsApps(): Promise<MapsApp[]> {
  // The platform's guaranteed app leads the set: Apple Maps ships with iOS,
  // Google Maps is the Android default. Apple Maps doesn't exist on Android, so
  // it's dropped there entirely (ADR-0015).
  if (Platform.OS === 'android') {
    const wazeInstalled = await Linking.canOpenURL(PROBE_SCHEME.waze!).catch(() => false);
    return wazeInstalled ? ['google', 'waze'] : ['google'];
  }
  const optional = Object.keys(PROBE_SCHEME) as MapsApp[];
  const available = await Promise.all(
    optional.map((app) => Linking.canOpenURL(PROBE_SCHEME[app]!).catch(() => false)),
  );
  return ['apple', ...optional.filter((_, i) => available[i])];
}

// Falls back to the installed set's head — Apple Maps on iOS, Google Maps on
// Android — when the stored preference points at an app that isn't installed (or
// doesn't exist on this platform, e.g. a stored `apple` on Android), so the chosen
// app can never dead-end.
export function reconcilePreferredMapsApp(preferred: MapsApp, installed: MapsApp[]): MapsApp {
  if (installed.includes(preferred)) return preferred;
  return installed[0] ?? 'apple';
}
