import { describe, it, expect, vi, afterEach } from 'vitest';
import { todayString, tripStatus, formatDayLabel, formatDateRange } from './date-utils';
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

describe('formatDayLabel', () => {
  it('renders a YYYY-MM-DD date as a short weekday, month and day', () => {
    // 2026-06-15 is a Monday.
    expect(formatDayLabel('2026-06-15')).toBe('Mon, Jun 15');
  });

  it('parses the date in local time so it does not shift across midnight UTC', () => {
    // If parsed as UTC, '2026-01-01' would render as Dec 31 in negative-offset
    // time zones. Parsing the Y-M-D parts directly avoids that drift.
    expect(formatDayLabel('2026-01-01')).toBe('Thu, Jan 1');
  });
});

describe('formatDateRange', () => {
  it('collapses the shared month and year within a single month', () => {
    expect(formatDateRange('2026-06-01', '2026-06-15')).toBe('Jun 1 – 15, 2026');
  });

  it('repeats the month but shares the year when crossing months', () => {
    expect(formatDateRange('2026-06-28', '2026-07-03')).toBe('Jun 28 – Jul 3, 2026');
  });

  it('spells out both years when the range crosses a year boundary', () => {
    expect(formatDateRange('2026-12-30', '2027-01-02')).toBe('Dec 30, 2026 – Jan 2, 2027');
  });
});
