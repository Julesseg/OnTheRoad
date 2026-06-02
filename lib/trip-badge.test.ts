import { describe, it, expect } from 'vitest';
import {
  tripCountdownBadge,
  approximateDuration,
  durationUnitWord,
  countdownPill,
} from './trip-badge';

const trip = { startDate: '2026-06-10', endDate: '2026-06-20' };

describe('tripCountdownBadge', () => {
  it('counts down the days before an upcoming trip', () => {
    expect(tripCountdownBadge(trip, '2026-06-04')).toEqual({ kind: 'before', days: 6 });
  });

  it('shows "now" on the start date', () => {
    expect(tripCountdownBadge(trip, '2026-06-10')).toEqual({ kind: 'now' });
  });

  it('shows "now" while in progress', () => {
    expect(tripCountdownBadge(trip, '2026-06-15')).toEqual({ kind: 'now' });
  });

  it('shows "now" on the end date', () => {
    expect(tripCountdownBadge(trip, '2026-06-20')).toEqual({ kind: 'now' });
  });

  it('counts up the days since a past (archived) trip ended', () => {
    expect(tripCountdownBadge(trip, '2026-06-23')).toEqual({ kind: 'after', days: 3 });
  });

  it('reports one day ago the day after the trip ends', () => {
    expect(tripCountdownBadge(trip, '2026-06-21')).toEqual({ kind: 'after', days: 1 });
  });
});

describe('approximateDuration', () => {
  it('keeps days under a week', () => {
    expect(approximateDuration(1)).toEqual({ value: 1, unit: 'day' });
    expect(approximateDuration(6)).toEqual({ value: 6, unit: 'day' });
  });

  it('rounds to weeks from one week up to a month', () => {
    expect(approximateDuration(7)).toEqual({ value: 1, unit: 'week' });
    expect(approximateDuration(20)).toEqual({ value: 3, unit: 'week' });
    expect(approximateDuration(29)).toEqual({ value: 4, unit: 'week' });
  });

  it('rounds to months from one month up to a year', () => {
    expect(approximateDuration(30)).toEqual({ value: 1, unit: 'month' });
    expect(approximateDuration(90)).toEqual({ value: 3, unit: 'month' });
    expect(approximateDuration(364)).toEqual({ value: 12, unit: 'month' });
  });

  it('rounds to years from a year onward', () => {
    expect(approximateDuration(365)).toEqual({ value: 1, unit: 'year' });
    expect(approximateDuration(730)).toEqual({ value: 2, unit: 'year' });
  });
});

describe('countdownPill', () => {
  const trip = { startDate: '2026-06-10', endDate: '2026-06-20' };

  it('reads "Now" while the trip is in progress', () => {
    expect(countdownPill(trip, '2026-06-15')).toBe('Now');
  });

  it('reads "Now" on the start and end dates', () => {
    expect(countdownPill(trip, '2026-06-10')).toBe('Now');
    expect(countdownPill(trip, '2026-06-20')).toBe('Now');
  });

  it('counts down to an upcoming trip in coarsened units', () => {
    expect(countdownPill(trip, '2026-06-04')).toBe('in 6 days');
    expect(countdownPill(trip, '2026-05-27')).toBe('in 2 weeks');
  });

  it('singularises a one-unit countdown', () => {
    expect(countdownPill(trip, '2026-06-09')).toBe('in 1 day');
  });

  it('counts up the days since an ended trip, coarsening the unit', () => {
    expect(countdownPill(trip, '2026-06-25')).toBe('5 days ago');
    expect(countdownPill(trip, '2026-07-11')).toBe('3 weeks ago');
  });
});

describe('durationUnitWord', () => {
  it('singularises a value of one', () => {
    expect(durationUnitWord({ value: 1, unit: 'week' })).toBe('week');
  });

  it('pluralises other values', () => {
    expect(durationUnitWord({ value: 3, unit: 'month' })).toBe('months');
  });
});
