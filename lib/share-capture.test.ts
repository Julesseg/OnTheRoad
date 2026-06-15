import { describe, it, expect, vi } from 'vitest';
import type { Trip } from './schema';
import type { PendingCapture } from './share-bridge';
import {
  parseShareParams,
  classifyShare,
  defaultCaptureDate,
  processPendingCapture,
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

describe('classifyShare — one share, one Item (multiple URLs)', () => {
  it('classifies the first URL and keeps the rest in notes', () => {
    const draft = classifyShare({
      text: 'https://a.example.com/place https://b.example.com/info',
    });
    expect(draft.category).toBe('activity');
    expect(draft.notes).toBe('https://a.example.com/place\nhttps://b.example.com/info');
  });

  it('classifies a maps first URL as a Place and appends the remaining links to notes', () => {
    const draft = classifyShare({
      url: 'https://www.google.com/maps/place/Eiffel+Tower/@48.8584,2.2945,17z',
      text: 'Eiffel Tower\nMore: https://en.wikipedia.org/wiki/Eiffel_Tower',
    });
    expect(draft.category).toBe('location');
    expect(draft.name).toBe('Eiffel Tower');
    expect(draft.notes).toBe(
      'https://www.google.com/maps/place/Eiffel+Tower/@48.8584,2.2945,17z\nhttps://en.wikipedia.org/wiki/Eiffel_Tower',
    );
  });

  it('does not let a link in the shared text leak into the place name', () => {
    const draft = classifyShare({
      url: 'https://example.com/page',
      text: 'Cool spot\nalso https://b.example.com',
    });
    expect(draft.name).toBe('Cool spot');
  });

  it('keeps a single-URL payload to just that link in notes', () => {
    const draft = classifyShare({ url: 'https://example.com/page', text: 'Cool spot' });
    expect(draft.notes).toBe('https://example.com/page');
  });

  it('does not duplicate a primary URL that also appears in the shared text', () => {
    const draft = classifyShare({
      url: 'https://a.example.com',
      text: 'See https://a.example.com and https://b.example.com',
    });
    expect(draft.notes).toBe('https://a.example.com\nhttps://b.example.com');
  });

  it('trims trailing sentence punctuation off a link embedded in prose', () => {
    const draft = classifyShare({ text: 'Check this out: https://a.example.com.' });
    expect(draft.notes).toBe('https://a.example.com');
  });

  it('still de-dups when the text repeats the primary link with trailing punctuation', () => {
    const draft = classifyShare({
      url: 'https://a.example.com',
      text: 'See https://a.example.com. Also https://b.example.com)',
    });
    expect(draft.notes).toBe('https://a.example.com\nhttps://b.example.com');
  });

  it('does not leave a doubled space in the name when a mid-line link is stripped', () => {
    const draft = classifyShare({ text: 'Visit https://x.com today' });
    expect(draft.name).toBe('Visit today');
  });
});

describe('classifyShare — link-less text branch', () => {
  it('turns link-less text into a Note named from its first line', () => {
    const draft = classifyShare({ text: 'Picnic by the river' });
    expect(draft.category).toBe('note');
    expect(draft.name).toBe('Picnic by the river');
  });

  it('keeps the lines after the first as the notes', () => {
    const draft = classifyShare({ text: 'Picnic by the river\nbring a blanket\nbuy bread' });
    expect(draft.name).toBe('Picnic by the river');
    expect(draft.notes).toBe('bring a blanket\nbuy bread');
  });

  it('leaves notes unset when there is only a single line', () => {
    const draft = classifyShare({ text: 'Picnic by the river' });
    expect(draft.notes).toBeUndefined();
  });

  it('is never given a location to auto-geocode', () => {
    const draft = classifyShare({ text: 'Picnic by the river\nbring a blanket' });
    expect(draft.location).toBeUndefined();
  });

  it('falls back to a generic name when the payload is empty', () => {
    expect(classifyShare({}).name).toBe('Shared note');
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

  it('never geocodes link-less shared text', async () => {
    const fetchImpl = vi.fn();
    const geocode = vi.fn();

    const coords = await resolveShareCoords(
      { text: 'Picnic by the river\nbring a blanket' },
      { fetchImpl, geocode },
    );

    expect(coords).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(geocode).not.toHaveBeenCalled();
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

describe('processPendingCapture', () => {
  const trip: Trip = {
    id: 'trip-1',
    schemaVersion: 3,
    title: 'Paris',
    startDate: '2026-09-05',
    endDate: '2026-09-07',
    days: [
      { id: 'day-1', date: '2026-09-05', items: [] },
      { id: 'day-2', date: '2026-09-06', items: [] },
      { id: 'day-3', date: '2026-09-07', items: [] },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const base = { tripId: 'trip-1', date: '2026-09-06', capturedAt: '2026-09-01T10:00:00.000Z' };
  const opts = { makeId: () => 'item-1' };

  it('lands the item on the trip and day the user picked', async () => {
    const res = await processPendingCapture(
      { ...base, url: 'https://example.com', text: 'Louvre' } as PendingCapture,
      trip,
      '2026-09-05',
      opts,
    );
    expect(res).toEqual({
      tripId: 'trip-1',
      dayId: 'day-2',
      item: expect.objectContaining({ id: 'item-1', name: 'Louvre', category: 'activity' }),
    });
  });

  it('keeps the user note above the shared links in notes', async () => {
    const res = await processPendingCapture(
      { ...base, url: 'https://example.com', text: 'Louvre', note: 'buy tickets' } as PendingCapture,
      trip,
      '2026-09-05',
      opts,
    );
    expect(res?.item.notes).toBe('buy tickets\n\nhttps://example.com');
  });

  it('parses inline maps coordinates offline without geocoding', async () => {
    const geocode = vi.fn();
    const res = await processPendingCapture(
      { ...base, url: 'https://maps.apple.com/?ll=48.8584,2.2945', text: 'Eiffel Tower' } as PendingCapture,
      trip,
      '2026-09-05',
      { ...opts, geocode },
    );
    expect(res?.item.category).toBe('location');
    expect(res?.item.location).toMatchObject({ lat: 48.8584, lng: 2.2945 });
    expect(geocode).not.toHaveBeenCalled();
  });

  it('geocodes a maps link that carries no inline coordinates', async () => {
    const res = await processPendingCapture(
      { ...base, url: 'https://maps.apple.com/?q=Eiffel+Tower', text: 'Eiffel Tower' } as PendingCapture,
      trip,
      '2026-09-05',
      {
        ...opts,
        fetchImpl: (async () => ({
          url: 'https://maps.apple.com/?q=Eiffel+Tower',
          text: async () => '',
        })) as unknown as typeof fetch,
        geocode: async () => ({ lat: 1, lng: 2 }),
      },
    );
    expect(res?.item.location).toMatchObject({ lat: 1, lng: 2 });
  });

  it('uses a confirmed title as the item name over the derived one', async () => {
    const res = await processPendingCapture(
      { ...base, url: 'https://example.com', text: 'Louvre', title: 'Louvre Museum' } as PendingCapture,
      trip,
      '2026-09-05',
      opts,
    );
    expect(res?.item.name).toBe('Louvre Museum');
  });

  it('falls back to the derived name when the title is blank', async () => {
    const res = await processPendingCapture(
      { ...base, url: 'https://example.com', text: 'Louvre', title: '   ' } as PendingCapture,
      trip,
      '2026-09-05',
      opts,
    );
    expect(res?.item.name).toBe('Louvre');
  });

  it('carries a picked HH:mm time onto the item', async () => {
    const res = await processPendingCapture(
      { ...base, url: 'https://example.com', text: 'Louvre', time: '09:15' } as PendingCapture,
      trip,
      '2026-09-05',
      opts,
    );
    expect(res?.item.time).toBe('09:15');
  });

  it('leaves the item untimed when no time was picked', async () => {
    const res = await processPendingCapture(
      { ...base, url: 'https://example.com', text: 'Louvre' } as PendingCapture,
      trip,
      '2026-09-05',
      opts,
    );
    expect(res?.item.time).toBeUndefined();
  });

  it('classifies link-less text as a note', async () => {
    const res = await processPendingCapture(
      { ...base, text: 'Remember sunscreen\nand a hat' } as PendingCapture,
      trip,
      '2026-09-05',
      opts,
    );
    expect(res?.item.category).toBe('note');
    expect(res?.item.name).toBe('Remember sunscreen');
    expect(res?.item.notes).toBe('and a hat');
  });

  it('falls back to the default capture day when the picked date is out of range', async () => {
    const res = await processPendingCapture(
      { ...base, date: '2030-01-01', url: 'https://x.com', text: 'X' } as PendingCapture,
      trip,
      '2026-09-06',
      opts,
    );
    // Today is in range, so the default capture day is today → day-2.
    expect(res?.dayId).toBe('day-2');
  });
});
