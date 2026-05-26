import { describe, it, expect } from 'vitest';
import { buildAppleMapsUrl, buildGoogleMapsUrl, buildWazeMapsUrl } from './maps';

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
