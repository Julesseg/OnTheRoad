import { Linking } from 'react-native';

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
  const optional = Object.keys(PROBE_SCHEME) as MapsApp[];
  const available = await Promise.all(
    optional.map((app) => Linking.canOpenURL(PROBE_SCHEME[app]!).catch(() => false)),
  );
  return ['apple', ...optional.filter((_, i) => available[i])];
}

// Falls back to Apple Maps (always present on iOS) when the stored preference
// points at an app that isn't installed, so the chosen app can never dead-end.
export function reconcilePreferredMapsApp(preferred: MapsApp, installed: MapsApp[]): MapsApp {
  return installed.includes(preferred) ? preferred : 'apple';
}
