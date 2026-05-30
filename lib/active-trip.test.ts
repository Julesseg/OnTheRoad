import { describe, it, expect } from 'vitest';
import type { TripSummary } from './schema';
import { canFavorite, resolveActiveTrip } from './active-trip';

function makeSummary(id: string, startDate: string, endDate: string): TripSummary {
  return { id, title: id, startDate, endDate };
}

describe('canFavorite', () => {
  it('returns true for an upcoming trip', () => {
    expect(canFavorite(makeSummary('t', '2026-08-01', '2026-08-10'), '2026-07-01')).toBe(true);
  });

  it('returns true for an in-progress trip', () => {
    expect(canFavorite(makeSummary('t', '2026-07-01', '2026-07-10'), '2026-07-05')).toBe(true);
  });

  it('returns true when today equals endDate (last day still active)', () => {
    expect(canFavorite(makeSummary('t', '2026-07-01', '2026-07-10'), '2026-07-10')).toBe(true);
  });

  it('returns false for a past trip', () => {
    expect(canFavorite(makeSummary('t', '2026-06-01', '2026-06-10'), '2026-07-01')).toBe(false);
  });
});

describe('resolveActiveTrip', () => {
  it('returns the favorite when it is set and not Past', () => {
    const summaries = [
      makeSummary('fav', '2026-08-01', '2026-08-10'),
      makeSummary('other', '2026-09-01', '2026-09-05'),
    ];
    expect(resolveActiveTrip(summaries, 'fav', '2026-07-01')).toEqual({
      tripId: 'fav',
      shouldClearFavorite: false,
    });
  });

  it('returns the favorite when it is currently in progress', () => {
    const summaries = [makeSummary('fav', '2026-07-01', '2026-07-10')];
    expect(resolveActiveTrip(summaries, 'fav', '2026-07-05')).toEqual({
      tripId: 'fav',
      shouldClearFavorite: false,
    });
  });

  it('clears and falls back when the favorite is Past', () => {
    const summaries = [
      makeSummary('past', '2026-05-01', '2026-05-10'),
      makeSummary('next', '2026-08-01', '2026-08-10'),
    ];
    const result = resolveActiveTrip(summaries, 'past', '2026-07-01');
    expect(result.shouldClearFavorite).toBe(true);
    expect(result.tripId).toBe('next');
  });

  it('clears and falls back when the favorite id is not in the summaries', () => {
    const summaries = [makeSummary('other', '2026-08-01', '2026-08-10')];
    const result = resolveActiveTrip(summaries, 'missing-id', '2026-07-01');
    expect(result.shouldClearFavorite).toBe(true);
    expect(result.tripId).toBe('other');
  });

  it('returns current-or-next when no favorite is set', () => {
    const summaries = [makeSummary('trip', '2026-08-01', '2026-08-10')];
    expect(resolveActiveTrip(summaries, null, '2026-07-01')).toEqual({
      tripId: 'trip',
      shouldClearFavorite: false,
    });
  });

  it('prefers in-progress over upcoming in the fallback', () => {
    const summaries = [
      makeSummary('upcoming', '2026-08-01', '2026-08-10'),
      makeSummary('inprogress', '2026-07-01', '2026-07-10'),
    ];
    const result = resolveActiveTrip(summaries, null, '2026-07-05');
    expect(result.tripId).toBe('inprogress');
  });

  it('excludes Past trips from the fallback', () => {
    const summaries = [
      makeSummary('past', '2026-05-01', '2026-05-10'),
      makeSummary('upcoming', '2026-08-01', '2026-08-10'),
    ];
    expect(resolveActiveTrip(summaries, null, '2026-07-01').tripId).toBe('upcoming');
  });

  it('returns null tripId when nothing qualifies and no favorite', () => {
    const summaries = [makeSummary('past', '2026-05-01', '2026-05-10')];
    expect(resolveActiveTrip(summaries, null, '2026-07-01')).toEqual({
      tripId: null,
      shouldClearFavorite: false,
    });
  });

  it('returns null tripId with shouldClearFavorite when favorite is Past and nothing qualifies', () => {
    const summaries = [makeSummary('past', '2026-05-01', '2026-05-10')];
    expect(resolveActiveTrip(summaries, 'past', '2026-07-01')).toEqual({
      tripId: null,
      shouldClearFavorite: true,
    });
  });
});
