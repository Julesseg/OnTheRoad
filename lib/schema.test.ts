import { describe, it, expect } from 'vitest';
import { TripSchema, DaySchema, ItemSchema, AppStateSchema } from './schema';

const VALID_TRIP = {
  id: '01900000-0000-7000-8000-000000000001',
  schemaVersion: 1,
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
    expect(result.schemaVersion).toBe(1);
    expect(result.startDate).toBe('2026-07-01');
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

  it('parses a day with optional notes', () => {
    const day = DaySchema.parse({
      id: '01900000-0000-7000-8000-000000000002',
      date: '2026-07-01',
      items: [],
      notes: 'Drive north along coast',
    });
    expect(day.notes).toBe('Drive north along coast');
  });
});

const ITEM_ID = '01900000-0000-7000-8000-000000000003';

describe('ItemSchema — location', () => {
  it('parses with required fields only', () => {
    const item = ItemSchema.parse({ type: 'location', id: ITEM_ID, name: 'Golden Gate Bridge' });
    expect(item.type).toBe('location');
    if (item.type === 'location') expect(item.name).toBe('Golden Gate Bridge');
  });

  it('parses with all optional fields', () => {
    const item = ItemSchema.parse({
      type: 'location', id: ITEM_ID, name: 'Golden Gate Bridge',
      address: '100 Bridge Way', lat: 37.8199, lng: -122.4783,
      time: '09:30', notes: 'Great view', attachments: ['photo.jpg'],
    });
    if (item.type === 'location') {
      expect(item.lat).toBe(37.8199);
      expect(item.attachments).toEqual(['photo.jpg']);
    }
  });

  it('rejects unknown item type', () => {
    expect(() => ItemSchema.parse({ type: 'flight', id: ITEM_ID, name: 'UA123' })).toThrow();
  });
});

describe('ItemSchema — accommodation', () => {
  it('parses with required fields only', () => {
    const item = ItemSchema.parse({ type: 'accommodation', id: ITEM_ID, name: 'Sea Cliff Inn' });
    expect(item.type).toBe('accommodation');
  });

  it('parses with optional check-in/out times', () => {
    const item = ItemSchema.parse({
      type: 'accommodation', id: ITEM_ID, name: 'Sea Cliff Inn',
      checkIn: '15:00', checkOut: '11:00', confirmationNumber: 'XYZ123',
    });
    if (item.type === 'accommodation') expect(item.checkIn).toBe('15:00');
  });
});

describe('ItemSchema — activity', () => {
  it('parses with required fields only', () => {
    const item = ItemSchema.parse({ type: 'activity', id: ITEM_ID, name: 'Whale watching' });
    expect(item.type).toBe('activity');
  });

  it('parses with optional duration', () => {
    const item = ItemSchema.parse({
      type: 'activity', id: ITEM_ID, name: 'Whale watching', duration: 120,
    });
    if (item.type === 'activity') expect(item.duration).toBe(120);
  });
});

describe('ItemSchema — note', () => {
  it('parses with required text field', () => {
    const item = ItemSchema.parse({ type: 'note', id: ITEM_ID, text: 'Remember sunscreen' });
    expect(item.type).toBe('note');
    if (item.type === 'note') expect(item.text).toBe('Remember sunscreen');
  });

  it('rejects note with empty text', () => {
    expect(() => ItemSchema.parse({ type: 'note', id: ITEM_ID, text: '' })).toThrow();
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
});
