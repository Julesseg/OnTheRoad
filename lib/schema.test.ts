import { describe, it, expect } from 'vitest';
import { TripSchema, DaySchema, ItemSchema, AppStateSchema, TripSummarySchema, CURRENT_SCHEMA_VERSION } from './schema';

const VALID_TRIP = {
  id: '01900000-0000-7000-8000-000000000001',
  schemaVersion: 3,
  title: 'Pacific Coast Highway',
  startDate: '2026-07-01',
  endDate: '2026-07-14',
  days: [],
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

describe('TripSchema', () => {
  it('parses a valid trip fixture', () => {
    const result = TripSchema.parse(VALID_TRIP);
    expect(result.title).toBe('Pacific Coast Highway');
    expect(result.schemaVersion).toBe(3);
    expect(result.startDate).toBe('2026-07-01');
  });

  it('parses a trip with a wallpaperUri', () => {
    const result = TripSchema.parse({
      ...VALID_TRIP,
      wallpaperUri: 'trips/01900000-0000-7000-8000-000000000001/wallpaper.jpg',
    });
    expect(result.wallpaperUri).toBe(
      'trips/01900000-0000-7000-8000-000000000001/wallpaper.jpg',
    );
  });

  it('parses a trip with no wallpaperUri (the field is optional)', () => {
    const result = TripSchema.parse(VALID_TRIP);
    expect(result.wallpaperUri).toBeUndefined();
  });

  it('rejects a trip with missing title', () => {
    const { title: _, ...noTitle } = VALID_TRIP;
    expect(() => TripSchema.parse(noTitle)).toThrow();
  });

  it('rejects a trip with invalid date format', () => {
    expect(() => TripSchema.parse({ ...VALID_TRIP, startDate: '01/07/2026' })).toThrow();
  });

  it('rejects a trip with a calendar-invalid date (Feb 30)', () => {
    expect(() => TripSchema.parse({ ...VALID_TRIP, startDate: '2026-02-30' })).toThrow();
  });

  it('rejects a trip with month 13', () => {
    expect(() => TripSchema.parse({ ...VALID_TRIP, startDate: '2026-13-01' })).toThrow();
  });
});

describe('DaySchema', () => {
  it('parses a valid day with no items', () => {
    const day = DaySchema.parse({
      id: '01900000-0000-7000-8000-000000000002',
      date: '2026-07-01',
      items: [],
    });
    expect(day.date).toBe('2026-07-01');
    expect(day.items).toHaveLength(0);
  });

  it('strips a stored day notes field that is no longer part of the model', () => {
    const day = DaySchema.parse({
      id: '01900000-0000-7000-8000-000000000002',
      date: '2026-07-01',
      items: [],
      notes: 'Drive north along coast',
    });
    expect('notes' in day).toBe(false);
  });
});

const ITEM_ID = '01900000-0000-7000-8000-000000000003';

describe('ItemSchema — unified v3', () => {
  it('parses a minimal item: name + category, no other fields', () => {
    const item = ItemSchema.parse({ id: ITEM_ID, name: 'Walk the pier', category: 'activity' });
    expect(item.name).toBe('Walk the pier');
    expect(item.category).toBe('activity');
  });

  it('accepts all five category values', () => {
    for (const cat of ['activity', 'location', 'stay', 'meal', 'note'] as const) {
      const item = ItemSchema.parse({ id: ITEM_ID, name: 'X', category: cat });
      expect(item.category).toBe(cat);
    }
  });

  it('rejects an unknown category value', () => {
    expect(() => ItemSchema.parse({ id: ITEM_ID, name: 'X', category: 'flight' })).toThrow();
  });

  it('requires a non-empty name', () => {
    expect(() => ItemSchema.parse({ id: ITEM_ID, name: '', category: 'activity' })).toThrow();
  });

  it('accepts optional time in HH:mm format', () => {
    const item = ItemSchema.parse({ id: ITEM_ID, name: 'Breakfast', category: 'meal', time: '08:30' });
    expect(item.time).toBe('08:30');
  });

  it('accepts an optional location sub-object with address, lat, and lng', () => {
    const item = ItemSchema.parse({
      id: ITEM_ID, name: 'Golden Gate', category: 'location',
      location: { address: '100 Bridge Way', lat: 37.8199, lng: -122.4783 },
    });
    expect(item.location?.address).toBe('100 Bridge Way');
    expect(item.location?.lat).toBe(37.8199);
  });

  it('accepts optional notes', () => {
    const item = ItemSchema.parse({ id: ITEM_ID, name: 'Hike', category: 'activity', notes: 'Bring sunscreen' });
    expect(item.notes).toBe('Bring sunscreen');
  });

  it('accepts an optional checklist array', () => {
    const item = ItemSchema.parse({
      id: ITEM_ID, name: 'Pack bag', category: 'activity',
      checklist: [{ id: ITEM_ID, label: 'Passport', checked: false }],
    });
    expect(item.checklist).toHaveLength(1);
    expect(item.checklist![0].label).toBe('Passport');
  });

  it('CURRENT_SCHEMA_VERSION is 3', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
  });
});

describe('TripSummarySchema', () => {
  const SUMMARY = {
    id: '01900000-0000-7000-8000-000000000001',
    title: 'Pacific Coast Highway',
    startDate: '2026-07-01',
    endDate: '2026-07-14',
  };

  it('carries a wallpaperUri so list screens can render the cover photo', () => {
    const result = TripSummarySchema.parse({
      ...SUMMARY,
      wallpaperUri: 'trips/01900000-0000-7000-8000-000000000001/wallpaper.jpg',
    });
    expect(result.wallpaperUri).toBe(
      'trips/01900000-0000-7000-8000-000000000001/wallpaper.jpg',
    );
  });

  it('parses a summary without a wallpaperUri', () => {
    const result = TripSummarySchema.parse(SUMMARY);
    expect(result.wallpaperUri).toBeUndefined();
  });
});

describe('AppStateSchema', () => {
  it('parses a valid app state with trips summary', () => {
    const state = AppStateSchema.parse({
      activeTripId: '01900000-0000-7000-8000-000000000001',
      trips: [
        {
          id: '01900000-0000-7000-8000-000000000001',
          title: 'Pacific Coast Highway',
          startDate: '2026-07-01',
          endDate: '2026-07-14',
        },
      ],
      lastUpdated: '2026-05-01T10:00:00.000Z',
    });
    expect(state.trips).toHaveLength(1);
    expect(state.activeTripId).toBe('01900000-0000-7000-8000-000000000001');
  });

  it('parses app state with null activeTripId (no active trip)', () => {
    const state = AppStateSchema.parse({
      activeTripId: null,
      trips: [],
      lastUpdated: '2026-05-01T10:00:00.000Z',
    });
    expect(state.activeTripId).toBeNull();
    expect(state.trips).toHaveLength(0);
  });

  it('defaults preferredMapsApp to apple when the field is absent', () => {
    const state = AppStateSchema.parse({
      activeTripId: null,
      trips: [],
      lastUpdated: '2026-05-01T10:00:00.000Z',
    });
    expect(state.preferredMapsApp).toBe('apple');
  });

  it('accepts an explicit preferredMapsApp of google', () => {
    const state = AppStateSchema.parse({
      activeTripId: null,
      trips: [],
      lastUpdated: '2026-05-01T10:00:00.000Z',
      preferredMapsApp: 'google',
    });
    expect(state.preferredMapsApp).toBe('google');
  });

  it('accepts an explicit preferredMapsApp of waze', () => {
    const state = AppStateSchema.parse({
      activeTripId: null,
      trips: [],
      lastUpdated: '2026-05-01T10:00:00.000Z',
      preferredMapsApp: 'waze',
    });
    expect(state.preferredMapsApp).toBe('waze');
  });

  it('rejects an unknown preferredMapsApp value', () => {
    expect(() =>
      AppStateSchema.parse({
        activeTripId: null,
        trips: [],
        lastUpdated: '2026-05-01T10:00:00.000Z',
        preferredMapsApp: 'bing',
      }),
    ).toThrow();
  });

  it('defaults appearance to system when the field is absent', () => {
    const state = AppStateSchema.parse({
      activeTripId: null,
      trips: [],
      lastUpdated: '2026-05-01T10:00:00.000Z',
    });
    expect(state.appearance).toBe('system');
  });

  it.each(['system', 'light', 'dark'] as const)('accepts an explicit appearance of %s', (mode) => {
    const state = AppStateSchema.parse({
      activeTripId: null,
      trips: [],
      lastUpdated: '2026-05-01T10:00:00.000Z',
      appearance: mode,
    });
    expect(state.appearance).toBe(mode);
  });

  it('rejects an unknown appearance value', () => {
    expect(() =>
      AppStateSchema.parse({
        activeTripId: null,
        trips: [],
        lastUpdated: '2026-05-01T10:00:00.000Z',
        appearance: 'sepia',
      }),
    ).toThrow();
  });
});
