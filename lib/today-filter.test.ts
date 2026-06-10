import { describe, it, expect } from 'vitest';
import { todayFilterModel } from './today-filter';
import type { TripBadge } from './trip-badge';
import type { Day } from './schema';

const now: TripBadge = { kind: 'now' };
const before: TripBadge = { kind: 'before', days: 3 };
const after: TripBadge = { kind: 'after', days: 2 };

const day = (date: string): Day => ({ id: date, date, items: [] });

const TODAY = '2026-06-07';
const multiDay = [day('2026-06-06'), day(TODAY), day('2026-06-08')];
const singleDay = [day(TODAY)];
const gapDays = [day('2026-06-05'), day('2026-06-06')]; // no entry for TODAY

describe('todayFilterModel', () => {
  it('in-progress, multi-day, today in days → canFilter=true, active=true (defaults ON)', () => {
    const result = todayFilterModel(multiDay, now, null, TODAY);
    expect(result).toEqual({ canFilter: true, active: true, activeDate: TODAY });
  });

  it('upcoming trip → canFilter=false, active=false', () => {
    const result = todayFilterModel(multiDay, before, null, TODAY);
    expect(result).toEqual({ canFilter: false, active: false, activeDate: null });
  });

  it('ended trip → canFilter=false, active=false', () => {
    const result = todayFilterModel(multiDay, after, null, TODAY);
    expect(result).toEqual({ canFilter: false, active: false, activeDate: null });
  });

  it('in-progress, single-day → canFilter=false, active=false', () => {
    const result = todayFilterModel(singleDay, now, null, TODAY);
    expect(result).toEqual({ canFilter: false, active: false, activeDate: null });
  });

  it('in-progress, multi-day, no day matches today → canFilter=false, active=false', () => {
    const result = todayFilterModel(gapDays, now, null, TODAY);
    expect(result).toEqual({ canFilter: false, active: false, activeDate: null });
  });

  it('explicit override=false suppresses active even when eligible', () => {
    const result = todayFilterModel(multiDay, now, false, TODAY);
    expect(result).toEqual({ canFilter: true, active: false, activeDate: null });
  });

  it('explicit override=true activates even when null would give same result', () => {
    const result = todayFilterModel(multiDay, now, true, TODAY);
    expect(result).toEqual({ canFilter: true, active: true, activeDate: TODAY });
  });

  it('date override filters that day on any trip, even when today-filter is ineligible', () => {
    const result = todayFilterModel(multiDay, before, '2026-06-08', TODAY);
    expect(result).toEqual({ canFilter: false, active: true, activeDate: '2026-06-08' });
  });

  it('date override not matching any day deactivates the filter', () => {
    const result = todayFilterModel(multiDay, now, '2026-07-01', TODAY);
    expect(result).toEqual({ canFilter: true, active: false, activeDate: null });
  });
});
