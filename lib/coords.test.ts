import { describe, it, expect } from 'vitest';
import { parseMapsUrl } from './coords';

describe('parseMapsUrl', () => {
  it('parses an Apple Maps ?ll= share URL', () => {
    expect(parseMapsUrl('maps://?ll=47.6062,-122.3321')).toEqual({
      lat: 47.6062,
      lng: -122.3321,
    });
  });

  it('parses an Apple Maps ?q= share URL', () => {
    expect(parseMapsUrl('maps://?q=47.6062,-122.3321')).toEqual({
      lat: 47.6062,
      lng: -122.3321,
    });
  });

  it('parses a Google Maps @lat,lng center URL', () => {
    expect(parseMapsUrl('https://www.google.com/maps/@47.6062,-122.3321,15z')).toEqual({
      lat: 47.6062,
      lng: -122.3321,
    });
  });

  it('parses a raw "lat, lng" pair typed by hand', () => {
    expect(parseMapsUrl('47.6062, -122.3321')).toEqual({ lat: 47.6062, lng: -122.3321 });
  });

  it('rejects pairs outside the geographic range', () => {
    expect(parseMapsUrl('200, 300')).toBeNull();
    expect(parseMapsUrl('maps://?ll=91,-122')).toBeNull();
  });

  it('parses a Google Maps place URL with the centre after the place name', () => {
    expect(
      parseMapsUrl('https://www.google.com/maps/place/Pike+Place+Market/@47.6097,-122.3422,17z/data=!3m1'),
    ).toEqual({ lat: 47.6097, lng: -122.3422 });
  });

  it('parses a maps.google.com ?q= URL', () => {
    expect(parseMapsUrl('https://maps.google.com/?q=47.6062,-122.3321')).toEqual({
      lat: 47.6062,
      lng: -122.3321,
    });
  });

  it('parses an Apple Maps ?daddr= directions URL', () => {
    expect(parseMapsUrl('maps://?daddr=47.6062,-122.3321')).toEqual({
      lat: 47.6062,
      lng: -122.3321,
    });
  });

  it('returns null for garbage and empty input', () => {
    expect(parseMapsUrl('hello')).toBeNull();
    expect(parseMapsUrl('')).toBeNull();
    expect(parseMapsUrl(null)).toBeNull();
    expect(parseMapsUrl(undefined)).toBeNull();
  });

  it('returns null for a URL with no parseable coordinates', () => {
    expect(parseMapsUrl('https://maps.apple.com/?q=Pike+Place+Market')).toBeNull();
  });

  it('returns null for shortened links that need a network redirect', () => {
    expect(parseMapsUrl('https://maps.app.goo.gl/abc123')).toBeNull();
    expect(parseMapsUrl('https://goo.gl/maps/abc123')).toBeNull();
  });
});
