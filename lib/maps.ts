import { Linking } from 'react-native';

export type MapsTarget = {
  coords?: { lat: number; lng: number };
  address?: string;
};

export type MapsApp = 'apple' | 'google';

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

export function openInMaps(target: MapsTarget, options: { app: MapsApp }): Promise<void> {
  const url = options.app === 'google' ? buildGoogleMapsUrl(target) : buildAppleMapsUrl(target);
  return Linking.openURL(url);
}
