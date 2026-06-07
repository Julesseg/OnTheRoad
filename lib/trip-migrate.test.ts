import { describe, it, expect } from 'vitest';
import { migrateTripData } from './trip-migrate';
import { TripSchema } from './schema';

const TRIP_BASE = {
  id: '01900000-0000-7000-8000-000000000001',
  title: 'Pacific Coast Highway',
  startDate: '2026-07-01',
  endDate: '2026-07-14',
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

const V1_TRIP = { ...TRIP_BASE, schemaVersion: 1, days: [] };
const V2_TRIP = { ...TRIP_BASE, schemaVersion: 2, days: [] };

const ITEM_ID = '01900000-0000-7000-8000-000000000002';

describe('migrateTripData — v1', () => {
  it('upgrades a v1 trip so it parses against the current schema', () => {
    const trip = TripSchema.parse(migrateTripData(V1_TRIP));
    expect(trip.schemaVersion).toBe(3);
  });

  it('leaves a v1 trip without a wallpaper (treated as no cover photo)', () => {
    const trip = TripSchema.parse(migrateTripData(V1_TRIP));
    expect(trip.wallpaperUri).toBeUndefined();
  });
});

describe('migrateTripData — v2 → v3: accommodation item', () => {
  it('becomes category "stay": checkIn→time, checkOut+confirmation prepended into notes', () => {
    const v2Trip = {
      ...V2_TRIP,
      days: [{
        id: '01900000-0000-7000-8000-000000000010',
        date: '2026-07-01',
        items: [{
          type: 'accommodation',
          id: ITEM_ID,
          name: 'Sea Cliff Inn',
          address: '123 Ocean Ave',
          checkIn: '15:00',
          checkOut: '11:00',
          confirmationNumber: 'XYZ123',
          notes: 'Quiet room requested',
        }],
      }],
    };
    const trip = TripSchema.parse(migrateTripData(v2Trip));
    const item = trip.days[0].items[0];
    expect(item.category).toBe('stay');
    expect(item.time).toBe('15:00');
    expect(item.location?.address).toBe('123 Ocean Ave');
    expect(item.notes).toContain('Check-out: 11:00');
    expect(item.notes).toContain('Confirmation: XYZ123');
    expect(item.notes).toContain('Quiet room requested');
  });

  it('omits notes entirely when the accommodation had no checkOut, confirmation, or notes', () => {
    const v2Trip = {
      ...V2_TRIP,
      days: [{
        id: '01900000-0000-7000-8000-000000000010',
        date: '2026-07-01',
        items: [{ type: 'accommodation', id: ITEM_ID, name: 'Basic Hotel', checkIn: '14:00' }],
      }],
    };
    const trip = TripSchema.parse(migrateTripData(v2Trip));
    const item = trip.days[0].items[0];
    expect(item.notes).toBeUndefined();
  });
});

describe('migrateTripData — v2 → v3: activity item', () => {
  it('becomes category "activity": duration prepended into notes when set', () => {
    const v2Trip = {
      ...V2_TRIP,
      days: [{
        id: '01900000-0000-7000-8000-000000000010',
        date: '2026-07-01',
        items: [{ type: 'activity', id: ITEM_ID, name: 'Whale watching', time: '10:00', duration: 120, notes: 'Book in advance' }],
      }],
    };
    const trip = TripSchema.parse(migrateTripData(v2Trip));
    const item = trip.days[0].items[0];
    expect(item.category).toBe('activity');
    expect(item.time).toBe('10:00');
    expect(item.notes).toContain('Duration: 120 min');
    expect(item.notes).toContain('Book in advance');
  });

  it('omits notes when the activity had no duration and no notes', () => {
    const v2Trip = {
      ...V2_TRIP,
      days: [{
        id: '01900000-0000-7000-8000-000000000010',
        date: '2026-07-01',
        items: [{ type: 'activity', id: ITEM_ID, name: 'Walk', time: '09:00' }],
      }],
    };
    const trip = TripSchema.parse(migrateTripData(v2Trip));
    expect(trip.days[0].items[0].notes).toBeUndefined();
  });
});

describe('migrateTripData — v2 → v3: note item', () => {
  it('becomes category "note": text first line becomes name, full text goes into notes', () => {
    const v2Trip = {
      ...V2_TRIP,
      days: [{
        id: '01900000-0000-7000-8000-000000000010',
        date: '2026-07-01',
        items: [{ type: 'note', id: ITEM_ID, text: 'Remember sunscreen\nAlso bring a hat\nAnd water' }],
      }],
    };
    const trip = TripSchema.parse(migrateTripData(v2Trip));
    const item = trip.days[0].items[0];
    expect(item.category).toBe('note');
    expect(item.name).toBe('Remember sunscreen');
    expect(item.notes).toBe('Remember sunscreen\nAlso bring a hat\nAnd water');
  });

  it('single-line note: text becomes name with no notes field', () => {
    const v2Trip = {
      ...V2_TRIP,
      days: [{
        id: '01900000-0000-7000-8000-000000000010',
        date: '2026-07-01',
        items: [{ type: 'note', id: ITEM_ID, text: 'Buy sunscreen' }],
      }],
    };
    const trip = TripSchema.parse(migrateTripData(v2Trip));
    const item = trip.days[0].items[0];
    expect(item.name).toBe('Buy sunscreen');
    expect(item.notes).toBeUndefined();
  });

  it('caps the name at 80 chars and preserves full text in notes', () => {
    const longFirstLine = 'A'.repeat(100);
    const v2Trip = {
      ...V2_TRIP,
      days: [{
        id: '01900000-0000-7000-8000-000000000010',
        date: '2026-07-01',
        items: [{ type: 'note', id: ITEM_ID, text: longFirstLine }],
      }],
    };
    const trip = TripSchema.parse(migrateTripData(v2Trip));
    const item = trip.days[0].items[0];
    expect(item.name.length).toBeLessThanOrEqual(80);
    expect(item.notes).toBe(longFirstLine);
  });
});

describe('migrateTripData — full v2 trip round-trip', () => {
  it('migrates a trip with all four v2 item types and validates against TripSchema', () => {
    const v2Trip = {
      ...V2_TRIP,
      days: [{
        id: '01900000-0000-7000-8000-000000000010',
        date: '2026-07-01',
        items: [
          { type: 'location', id: '01900000-0000-7000-8000-000000000020', name: 'Golden Gate', address: 'SF', lat: 37.8, lng: -122.4, time: '09:00', notes: 'Great view' },
          { type: 'accommodation', id: '01900000-0000-7000-8000-000000000021', name: 'Inn', address: '1 Main St', checkIn: '15:00', checkOut: '11:00', confirmationNumber: 'ABC1' },
          { type: 'activity', id: '01900000-0000-7000-8000-000000000022', name: 'Hike', time: '10:00', duration: 90 },
          { type: 'note', id: '01900000-0000-7000-8000-000000000023', text: 'Pack light\nBring snacks' },
        ],
      }],
    };
    const trip = TripSchema.parse(migrateTripData(v2Trip));
    expect(trip.schemaVersion).toBe(3);
    expect(trip.days[0].items).toHaveLength(4);
    const [loc, stay, act, note] = trip.days[0].items;
    expect(loc.category).toBe('location');
    expect(stay.category).toBe('stay');
    expect(act.category).toBe('activity');
    expect(note.category).toBe('note');
  });
});

describe('migrateTripData — v2 → v3: location item', () => {
  it('migrates a v2 location item to category "location" with a location sub-object', () => {
    const v2Trip = {
      ...V2_TRIP,
      days: [{
        id: '01900000-0000-7000-8000-000000000010',
        date: '2026-07-01',
        items: [{
          type: 'location',
          id: ITEM_ID,
          name: 'Golden Gate Bridge',
          address: '100 Bridge Way',
          lat: 37.8199,
          lng: -122.4783,
          time: '09:30',
          notes: 'Great view',
        }],
      }],
    };
    const trip = TripSchema.parse(migrateTripData(v2Trip));
    const item = trip.days[0].items[0];
    expect(item.category).toBe('location');
    expect(item.name).toBe('Golden Gate Bridge');
    expect(item.time).toBe('09:30');
    expect(item.location?.address).toBe('100 Bridge Way');
    expect(item.location?.lat).toBe(37.8199);
    expect(item.location?.lng).toBe(-122.4783);
    expect(item.notes).toBe('Great view');
  });
});
