import { describe, it, expect, vi, afterEach } from 'vitest';
import { todayString, tripStatus } from './date-utils';
import type { TripSummary } from './schema';

function makeSummary(startDate: string, endDate: string): TripSummary {
  return { id: 't', title: 'T', startDate, endDate };
}

describe('todayString', () => {
  it('returns an ISO date in YYYY-MM-DD format', () => {
    expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('tripStatus', () => {
  afterEach(() => vi.restoreAllMocks());

  function mockToday(date: string) {
    vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(Number(date.slice(0, 4)));
    vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(Number(date.slice(5, 7)) - 1);
    vi.spyOn(Date.prototype, 'getDate').mockReturnValue(Number(date.slice(8, 10)));
  }

  it('returns Past when endDate is before today', () => {
    mockToday('2026-05-23');
    expect(tripStatus(makeSummary('2026-04-01', '2026-05-20'))).toBe('Past');
  });

  it('returns Upcoming when startDate is after today', () => {
    mockToday('2026-05-23');
    expect(tripStatus(makeSummary('2026-06-01', '2026-06-10'))).toBe('Upcoming');
  });

  it('returns In progress when today is between startDate and endDate', () => {
    mockToday('2026-05-23');
    expect(tripStatus(makeSummary('2026-05-20', '2026-05-25'))).toBe('In progress');
  });

  it('returns In progress when today equals startDate', () => {
    mockToday('2026-05-23');
    expect(tripStatus(makeSummary('2026-05-23', '2026-05-25'))).toBe('In progress');
  });

  it('returns In progress when today equals endDate', () => {
    mockToday('2026-05-23');
    expect(tripStatus(makeSummary('2026-05-20', '2026-05-23'))).toBe('In progress');
  });
});
