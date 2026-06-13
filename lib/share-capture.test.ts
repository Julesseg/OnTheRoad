import { describe, it, expect, vi } from 'vitest';
import {
  parseShareParams,
  classifyShare,
  defaultCaptureDate,
  resolveShareCoords,
} from './share-capture';

describe('parseShareParams', () => {
  it('pulls url and text out of the deep-link params', () => {
    expect(parseShareParams({ url: 'https://example.com', text: 'A cool place' })).toEqual({
      url: 'https://example.com',
      text: 'A cool place',
    });
  });

  it('omits a param that is absent', () => {
    expect(parseShareParams({ url: 'https://example.com' })).toEqual({
      url: 'https://example.com',
    });
  });

  it('treats an empty or whitespace-only param as absent', () => {
    expect(parseShareParams({ url: '   ', text: '' })).toEqual({});
  });

  it('trims surrounding whitespace from the values', () => {
    expect(parseShareParams({ url: '  https://example.com  ', text: '  hi  ' })).toEqual({
      url: 'https://example.com',
      text: 'hi',
    });
  });

  it('takes the first value when a param arrives as an array', () => {
    expect(parseShareParams({ url: ['https://a.com', 'https://b.com'] })).toEqual({
      url: 'https://a.com',
    });
  });
});

describe('classifyShare — generic URL branch', () => {
  it('turns a shared URL into an Activity with the link kept in notes', () => {
    const draft = classifyShare({ url: 'https://maps.example.com/place/42', text: 'Sunset Point' });
    expect(draft.category).toBe('activity');
    expect(draft.notes).toBe('https://maps.example.com/place/42');
  });

  it('names the item from the shared text', () => {
    const draft = classifyShare({ url: 'https://example.com', text: 'Sunset Point' });
    expect(draft.name).toBe('Sunset Point');
  });

  it('uses only the first line of multi-line shared text as the name', () => {
    const draft = classifyShare({ url: 'https://example.com', text: 'Sunset Point\nopen till 9pm' });
    expect(draft.name).toBe('Sunset Point');
  });

  it("falls back to the link's host (without www.) when there is no shared text", () => {
    expect(classifyShare({ url: 'https://www.example.com/place/42' }).name).toBe('example.com');
  });

  it('falls back to the host when the shared text is blank', () => {
    expect(classifyShare({ url: 'https://example.com', text: '   ' }).name).toBe('example.com');
  });
});

describe('classifyShare — maps-link branch', () => {
  const FULL_GOOGLE =
    'https://www.google.com/maps/place/Eiffel+Tower/@48.8584,2.2945,17z';

  it('turns a Google Maps link into a Place with the link kept in notes', () => {
    const draft = classifyShare({ url: FULL_GOOGLE, text: 'Eiffel Tower' });
    expect(draft.category).toBe('location');
    expect(draft.notes).toBe(FULL_GOOGLE);
  });

  it.each([
    ['Apple Maps', 'https://maps.apple.com/?ll=48.8584,2.2945&q=Eiffel+Tower'],
    ['a Google short link', 'https://maps.app.goo.gl/abcDEF123'],
    ['a legacy goo.gl/maps short link', 'https://goo.gl/maps/abcDEF123'],
    ['a maps.google host', 'https://maps.google.com/?q=48.8584,2.2945'],
    ['a google.*/maps path', 'https://www.google.de/maps/place/Eiffel+Tower'],
    ['a google.co.uk/maps path', 'https://www.google.co.uk/maps/place/Big+Ben'],
  ])('recognizes %s as a Place', (_label, url) => {
    expect(classifyShare({ url }).category).toBe('location');
  });

  it.each([
    ['a maps-look-alike host', 'https://maps.example.com/place/42'],
    ['a spoofed google subdomain', 'https://google.com.attacker.net/maps/place/x'],
    ['a bare goo.gl link with no /maps path', 'https://goo.gl/abcDEF123'],
  ])('leaves %s as a generic Activity', (_label, url) => {
    expect(classifyShare({ url }).category).toBe('activity');
  });

  it('names the Place from the shared text and keeps the link in notes', () => {
    const draft = classifyShare({ url: FULL_GOOGLE, text: 'Eiffel Tower\n5 Av. Anatole' });
    expect(draft.name).toBe('Eiffel Tower');
  });

  it("falls back to the link's host when there is no shared text", () => {
    expect(classifyShare({ url: 'https://maps.app.goo.gl/abcDEF123' }).name).toBe('maps.app.goo.gl');
  });

  it('carries the address from the lines after the name', () => {
    const draft = classifyShare({
      url: FULL_GOOGLE,
      text: 'Eiffel Tower\n5 Av. Anatole France, 75007 Paris',
    });
    expect(draft.location?.address).toBe('5 Av. Anatole France, 75007 Paris');
  });

  it('parses coordinates straight from a full URL, with no address when text is name-only', () => {
    const draft = classifyShare({ url: FULL_GOOGLE, text: 'Eiffel Tower' });
    expect(draft.location).toEqual({ lat: 48.8584, lng: 2.2945 });
  });

  it('omits location entirely when there is neither address nor parseable coordinates', () => {
    const draft = classifyShare({ url: 'https://maps.app.goo.gl/abcDEF123' });
    expect(draft.location).toBeUndefined();
  });
});

describe('resolveShareCoords — network layers (ADR-0007)', () => {
  const SHORT = 'https://maps.app.goo.gl/abcDEF123';
  const RESOLVED = 'https://www.google.com/maps/place/Eiffel+Tower/@48.8584,2.2945,17z';

  it('parses a full URL without any network call', async () => {
    const fetchImpl = vi.fn();
    const geocode = vi.fn();

    const coords = await resolveShareCoords({ url: RESOLVED }, { fetchImpl, geocode });

    expect(coords).toEqual({ lat: 48.8584, lng: 2.2945 });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(geocode).not.toHaveBeenCalled();
  });

  it('follows a short link and parses coordinates from the resolved URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ url: RESOLVED, text: async () => '' });
    const geocode = vi.fn();

    const coords = await resolveShareCoords({ url: SHORT, text: 'Eiffel Tower' }, { fetchImpl, geocode });

    expect(coords).toEqual({ lat: 48.8584, lng: 2.2945 });
    expect(geocode).not.toHaveBeenCalled();
  });
  it('geocodes the shared text when the redirect yields no coordinates', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ url: 'https://www.google.com/maps/place/Nowhere', text: async () => '' });
    const geocode = vi.fn().mockResolvedValue({ lat: 47.6, lng: -122.3 });

    const coords = await resolveShareCoords(
      { url: SHORT, text: 'Pike Place Market\nSeattle' },
      { fetchImpl, geocode },
    );

    expect(coords).toEqual({ lat: 47.6, lng: -122.3 });
    expect(geocode).toHaveBeenCalledWith('Pike Place Market\nSeattle');
  });

  it('returns null when every layer fails (offline), never throwing', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const geocode = vi.fn().mockRejectedValue(new Error('offline'));

    const coords = await resolveShareCoords(
      { url: SHORT, text: 'Pike Place Market' },
      { fetchImpl, geocode },
    );

    expect(coords).toBeNull();
  });

  it('returns null for a payload that is not a maps link, without any network call', async () => {
    const fetchImpl = vi.fn();
    const geocode = vi.fn();

    const coords = await resolveShareCoords(
      { url: 'https://example.com/place', text: 'Somewhere' },
      { fetchImpl, geocode },
    );

    expect(coords).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(geocode).not.toHaveBeenCalled();
  });
});

describe('defaultCaptureDate', () => {
  const trip = { startDate: '2026-06-10', endDate: '2026-06-20' };

  it('defaults to today when the trip is in progress', () => {
    expect(defaultCaptureDate(trip, '2026-06-13')).toBe('2026-06-13');
  });

  it('counts the first and last day as in progress', () => {
    expect(defaultCaptureDate(trip, '2026-06-10')).toBe('2026-06-10');
    expect(defaultCaptureDate(trip, '2026-06-20')).toBe('2026-06-20');
  });

  it("defaults to the trip's first day when the trip has not started", () => {
    expect(defaultCaptureDate(trip, '2026-06-01')).toBe('2026-06-10');
  });

  it("defaults to the trip's first day when the trip is already past", () => {
    expect(defaultCaptureDate(trip, '2026-07-01')).toBe('2026-06-10');
  });
});
