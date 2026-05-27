import { describe, it, expect, vi } from 'vitest';
import { parseMapsUrl, resolveMapsUrl } from './coords';

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

  it('prefers the !3d/!4d dropped-pin coordinates over the @ viewport centre', () => {
    expect(
      parseMapsUrl('https://www.google.com/maps/place/X/@47.61,-122.34,17z/data=!3d47.6097!4d-122.3422'),
    ).toEqual({ lat: 47.6097, lng: -122.3422 });
  });
});

describe('resolveMapsUrl', () => {
  it('parses offline without any network call when coordinates are already present', async () => {
    const fetchImpl = vi.fn();
    await expect(resolveMapsUrl('maps://?ll=47.6062,-122.3321', fetchImpl)).resolves.toEqual({
      lat: 47.6062,
      lng: -122.3321,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('follows a short-link redirect and parses the resolved URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      url: 'https://www.google.com/maps/place/Pike+Place/@47.61,-122.34,17z/data=!3d47.6097!4d-122.3422',
      text: async () => '',
    });
    await expect(resolveMapsUrl('https://maps.app.goo.gl/abc123', fetchImpl)).resolves.toEqual({
      lat: 47.6097,
      lng: -122.3422,
    });
    expect(fetchImpl).toHaveBeenCalledWith('https://maps.app.goo.gl/abc123');
  });

  it('falls back to the response body when the resolved URL has no coordinates', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      url: 'https://www.google.com/maps',
      text: async () => 'APP_INITIALIZATION_STATE=[[[...]],...!3d47.6097!4d-122.3422...',
    });
    await expect(resolveMapsUrl('https://maps.app.goo.gl/xyz', fetchImpl)).resolves.toEqual({
      lat: 47.6097,
      lng: -122.3422,
    });
  });

  it('returns null when the request fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(resolveMapsUrl('https://maps.app.goo.gl/abc', fetchImpl)).resolves.toBeNull();
  });

  it('returns null for non-URL garbage without attempting a fetch', async () => {
    const fetchImpl = vi.fn();
    await expect(resolveMapsUrl('hello', fetchImpl)).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
