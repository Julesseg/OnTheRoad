import { describe, it, expect } from 'vitest';
import { importTripFromJson, serializeTrip } from './trip-io';

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
  it('returns an error (not a throw) for text that is not valid JSON', () => {
    const res = importTripFromJson('this is not json', FRESH_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/json/i);
  });

  it('labels an absent required field with the "Missing required field:" prefix', () => {
    const { startDate: _omit, ...noStartDate } = VALID_TRIP;
    const res = importTripFromJson(JSON.stringify(noStartDate), FRESH_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('Missing required field: startDate');
  });

  it('does not label a present-but-wrong-type field as missing', () => {
    const res = importTripFromJson(JSON.stringify({ ...VALID_TRIP, title: 123 }), FRESH_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('title');
      expect(res.error).not.toContain('Missing required field');
    }
  });

  it('returns an error naming the nested path for an unknown item type', () => {
    const bad = {
      ...VALID_TRIP,
      days: [
        {
          id: '01900000-0000-7000-8000-0000000000a1',
          date: '2026-07-01',
          items: [{ type: 'flight', id: '01900000-0000-7000-8000-0000000000b1', name: 'UA1' }],
        },
      ],
    };
    const res = importTripFromJson(JSON.stringify(bad), FRESH_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('days.0.items.0');
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
