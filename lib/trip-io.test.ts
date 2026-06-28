import { describe, it, expect } from 'vitest';
import { importTripFromJson, importErrorMessage, normalizePastedJson, serializeTrip } from './trip-io';

const FRESH_ID = '019fffff-ffff-7fff-8fff-ffffffffffff';

const VALID_TRIP = {
  id: '01900000-0000-7000-8000-000000000001',
  schemaVersion: 1,
  title: 'Pacific Coast Highway',
  startDate: '2026-07-01',
  endDate: '2026-07-02',
  days: [
    {
      id: '01900000-0000-7000-8000-0000000000a1',
      date: '2026-07-01',
      items: [
        { type: 'location', id: '01900000-0000-7000-8000-0000000000b1', name: 'Golden Gate Bridge' },
      ],
    },
    { id: '01900000-0000-7000-8000-0000000000a2', date: '2026-07-02', items: [] },
  ],
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

describe('importTripFromJson', () => {
  it('parses a valid trip and assigns the provided fresh id', () => {
    const res = importTripFromJson(JSON.stringify(VALID_TRIP), FRESH_ID);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.trip.title).toBe('Pacific Coast Highway');
      expect(res.trip.id).toBe(FRESH_ID);
    }
  });
});

describe('serializeTrip', () => {
  it('round-trips a trip through serialize then import, preserving content', () => {
    const imported = importTripFromJson(JSON.stringify(VALID_TRIP), VALID_TRIP.id);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const json = serializeTrip(imported.trip);
    const reimported = importTripFromJson(json, VALID_TRIP.id);

    expect(reimported.ok).toBe(true);
    if (reimported.ok) expect(reimported.trip).toEqual(imported.trip);
  });
});

describe('importTripFromJson — errors', () => {
  it('returns an invalid-json error (not a throw) for text that is not valid JSON', () => {
    const res = importTripFromJson('this is not json', FRESH_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe('invalid-json');
  });

  it('returns an empty error (not a throw) for blank input', () => {
    for (const blank of ['', '   ', '\n\t ']) {
      const res = importTripFromJson(blank, FRESH_ID);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.kind).toBe('empty');
    }
  });

  it('returns an invalid-json error for a truncated / corrupt blob', () => {
    // A file cut off mid-object — valid JSON until the truncation point.
    const truncated = JSON.stringify(VALID_TRIP).slice(0, 80);
    const res = importTripFromJson(truncated, FRESH_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe('invalid-json');
  });

  it('returns an invalid-trip error (not a throw) for valid JSON that is not a trip', () => {
    for (const notATrip of ['42', '"hello"', 'null', '[1,2,3]', '{}']) {
      const res = importTripFromJson(notATrip, FRESH_ID);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.kind).toBe('invalid-trip');
    }
  });

  it('labels an absent required field with the "Missing required field:" prefix in the detail', () => {
    const { startDate: _omit, ...noStartDate } = VALID_TRIP;
    const res = importTripFromJson(JSON.stringify(noStartDate), FRESH_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe('invalid-trip');
      if (res.error.kind === 'invalid-trip') {
        expect(res.error.detail).toContain('Missing required field: startDate');
      }
    }
  });

  it('does not label a present-but-wrong-type field as missing', () => {
    const res = importTripFromJson(JSON.stringify({ ...VALID_TRIP, title: 123 }), FRESH_ID);
    expect(res.ok).toBe(false);
    if (!res.ok && res.error.kind === 'invalid-trip') {
      expect(res.error.detail).toContain('title');
      expect(res.error.detail).not.toContain('Missing required field');
    }
  });

  it('names the nested path in the detail for an invalid item category', () => {
    // Use schemaVersion: 3 so migration passes through, then schema rejects the invalid category.
    const bad = {
      ...VALID_TRIP,
      schemaVersion: 3,
      days: [
        {
          id: '01900000-0000-7000-8000-0000000000a1',
          date: '2026-07-01',
          items: [{ id: '01900000-0000-7000-8000-0000000000b1', name: 'UA1', category: 'flight' }],
        },
      ],
    };
    const res = importTripFromJson(JSON.stringify(bad), FRESH_ID);
    expect(res.ok).toBe(false);
    if (!res.ok && res.error.kind === 'invalid-trip') expect(res.error.detail).toContain('days.0.items.0');
  });
});

describe('importErrorMessage', () => {
  it('renders a non-empty, friendly message for every error kind', () => {
    expect(importErrorMessage({ kind: 'empty' })).toBeTruthy();
    expect(importErrorMessage({ kind: 'invalid-json' })).toBeTruthy();
    const withDetail = importErrorMessage({ kind: 'invalid-trip', detail: 'days.0.items.0' });
    // The friendly lead-in carries the technical detail for the curious.
    expect(withDetail).toContain('days.0.items.0');
  });
});

describe('importTripFromJson — wallpaper', () => {
  it('drops wallpaperUri because the image file never travels with the JSON', () => {
    const withWallpaper = {
      ...VALID_TRIP,
      wallpaperUri: 'trips/01900000-0000-7000-8000-000000000001/wallpaper.jpg',
    };
    const res = importTripFromJson(JSON.stringify(withWallpaper), FRESH_ID);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.trip.wallpaperUri).toBeUndefined();
  });
});

describe('importTripFromJson — id handling', () => {
  it('discards the original trip id but preserves day and item ids', () => {
    const res = importTripFromJson(JSON.stringify(VALID_TRIP), FRESH_ID);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.trip.id).toBe(FRESH_ID);
      expect(res.trip.id).not.toBe(VALID_TRIP.id);
      expect(res.trip.days[0].id).toBe(VALID_TRIP.days[0].id);
      expect(res.trip.days[0].items[0].id).toBe(VALID_TRIP.days[0].items[0].id);
    }
  });
});

describe('normalizePastedJson', () => {
  // A trip text value that legitimately contains a typographic apostrophe — the
  // exact character iOS Smart Punctuation also emits, so the normalizer must keep
  // it while only folding the structural double quotes.
  const TRIP_WITH_APOSTROPHE = {
    ...VALID_TRIP,
    schemaVersion: 3,
    days: [
      {
        id: '01900000-0000-7000-8000-0000000000a1',
        date: '2026-07-01',
        items: [
          {
            id: '01900000-0000-7000-8000-0000000000b1',
            name: 'Locker',
            category: 'note',
            notes: 'Jusqu’à 15h',
          },
        ],
      },
    ],
  };

  it('leaves clean JSON untouched', () => {
    const clean = JSON.stringify(VALID_TRIP);
    expect(normalizePastedJson(clean)).toBe(clean);
  });

  it('folds iOS smart double quotes back so the blob parses again', () => {
    const clean = JSON.stringify(TRIP_WITH_APOSTROPHE);
    // iOS rewrites the straight delimiter quotes to typographic “ ”.
    const smart = clean.replace(/"/g, (() => {
      let open = false;
      return () => ((open = !open) ? '“' : '”');
    })());
    expect(() => JSON.parse(smart)).toThrow();

    const res = importTripFromJson(normalizePastedJson(smart), FRESH_ID);
    expect(res.ok).toBe(true);
    // The apostrophe inside the string value survives — only delimiters changed.
    if (res.ok) expect(res.trip.days[0].items[0].notes).toBe('Jusqu’à 15h');
  });

  it('strips a surrounding Markdown code fence', () => {
    const clean = JSON.stringify(VALID_TRIP);
    expect(normalizePastedJson('```json\n' + clean + '\n```')).toBe(clean);
    expect(normalizePastedJson('```\n' + clean + '\n```')).toBe(clean);
  });

  it('trims surrounding whitespace', () => {
    const clean = JSON.stringify(VALID_TRIP);
    expect(normalizePastedJson('  \n' + clean + '\n  ')).toBe(clean);
  });
});
