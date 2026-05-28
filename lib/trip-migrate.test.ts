import { describe, it, expect } from 'vitest';
import { migrateTripData } from './trip-migrate';
import { TripSchema } from './schema';

const V1_TRIP = {
  id: '01900000-0000-7000-8000-000000000001',
  schemaVersion: 1,
  title: 'Pacific Coast Highway',
  startDate: '2026-07-01',
  endDate: '2026-07-14',
  days: [],
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

describe('migrateTripData', () => {
  it('upgrades a v1 trip so it parses against the current schema', () => {
    const migrated = migrateTripData(V1_TRIP);
    const trip = TripSchema.parse(migrated);
    expect(trip.schemaVersion).toBe(2);
  });

  it('leaves a v1 trip without a wallpaper (treated as no cover photo)', () => {
    const trip = TripSchema.parse(migrateTripData(V1_TRIP));
    expect(trip.wallpaperUri).toBeUndefined();
  });

  it('passes a current-version trip through unchanged', () => {
    const v2 = { ...V1_TRIP, schemaVersion: 2 };
    expect(migrateTripData(v2)).toEqual(v2);
  });
});
