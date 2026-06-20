import { describe, it, expect } from 'vitest';
import {
  buildAppleMapsUrl,
  buildGoogleMapsUrl,
  buildWazeMapsUrl,
  reconcilePreferredMapsApp,
} from './maps';

describe('buildAppleMapsUrl', () => {
  it('builds a daddr directions URL from coords', () => {
    expect(buildAppleMapsUrl({ coords: { lat: 47.6062, lng: -122.3321 } })).toBe(
      'maps://?daddr=47.6062,-122.3321',
    );
  });

  it('builds a daddr directions URL from an address', () => {
    expect(buildAppleMapsUrl({ address: '100 Bridge Way' })).toBe(
      'maps://?daddr=100%20Bridge%20Way',
    );
  });

  it('prefers coords over address when both are present', () => {
    expect(
      buildAppleMapsUrl({ coords: { lat: 47.6062, lng: -122.3321 }, address: '100 Bridge Way' }),
    ).toBe('maps://?daddr=47.6062,-122.3321');
  });

  it('url-encodes special characters in an address', () => {
    expect(buildAppleMapsUrl({ address: 'Café René, 1 Rue de la Paix' })).toBe(
      'maps://?daddr=Caf%C3%A9%20Ren%C3%A9%2C%201%20Rue%20de%20la%20Paix',
    );
  });
});

describe('buildGoogleMapsUrl', () => {
  it('builds a daddr directions URL from coords', () => {
    expect(buildGoogleMapsUrl({ coords: { lat: 47.6062, lng: -122.3321 } })).toBe(
      'comgooglemaps://?daddr=47.6062,-122.3321',
    );
  });

  it('builds a daddr directions URL from an address', () => {
    expect(buildGoogleMapsUrl({ address: '100 Bridge Way' })).toBe(
      'comgooglemaps://?daddr=100%20Bridge%20Way',
    );
  });

  it('prefers coords over address when both are present', () => {
    expect(
      buildGoogleMapsUrl({ coords: { lat: 47.6062, lng: -122.3321 }, address: '100 Bridge Way' }),
    ).toBe('comgooglemaps://?daddr=47.6062,-122.3321');
  });

  it('url-encodes special characters in an address', () => {
    expect(buildGoogleMapsUrl({ address: 'Café René, 1 Rue de la Paix' })).toBe(
      'comgooglemaps://?daddr=Caf%C3%A9%20Ren%C3%A9%2C%201%20Rue%20de%20la%20Paix',
    );
  });
});

describe('buildWazeMapsUrl', () => {
  it('navigates to coords via the ll parameter', () => {
    expect(buildWazeMapsUrl({ coords: { lat: 47.6062, lng: -122.3321 } })).toBe(
      'waze://?ll=47.6062,-122.3321&navigate=yes',
    );
  });

  it('navigates to an address via the q parameter', () => {
    expect(buildWazeMapsUrl({ address: '100 Bridge Way' })).toBe(
      'waze://?q=100%20Bridge%20Way&navigate=yes',
    );
  });

  it('prefers coords over address when both are present', () => {
    expect(
      buildWazeMapsUrl({ coords: { lat: 47.6062, lng: -122.3321 }, address: '100 Bridge Way' }),
    ).toBe('waze://?ll=47.6062,-122.3321&navigate=yes');
  });

  it('url-encodes special characters in an address', () => {
    expect(buildWazeMapsUrl({ address: 'Café René, 1 Rue de la Paix' })).toBe(
      'waze://?q=Caf%C3%A9%20Ren%C3%A9%2C%201%20Rue%20de%20la%20Paix&navigate=yes',
    );
  });
});

describe('reconcilePreferredMapsApp', () => {
  it('keeps the preference when that app is installed', () => {
    expect(reconcilePreferredMapsApp('google', ['apple', 'google'])).toBe('google');
  });

  it('falls back to apple when the preferred app is not installed', () => {
    expect(reconcilePreferredMapsApp('google', ['apple', 'waze'])).toBe('apple');
  });

  it('falls back to apple when only apple is available', () => {
    expect(reconcilePreferredMapsApp('waze', ['apple'])).toBe('apple');
  });

  // The fallback is the installed set's head — Apple Maps on iOS, Google Maps on
  // Android — so a stored preference can never dead-end on either platform.
  it('reconciles a stored apple preference to Google Maps on Android', () => {
    // On Android the installed set has no Apple Maps and leads with Google.
    expect(reconcilePreferredMapsApp('apple', ['google', 'waze'])).toBe('google');
  });

  it('falls back to Google Maps on Android when the preferred app is not installed', () => {
    expect(reconcilePreferredMapsApp('waze', ['google'])).toBe('google');
  });
});
