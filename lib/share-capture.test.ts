import { describe, it, expect } from 'vitest';
import { parseShareParams, classifyShare, defaultCaptureDate } from './share-capture';

describe('parseShareParams', () => {
  it('pulls url and text out of the deep-link params', () => {
    expect(parseShareParams({ url: 'https://example.com', text: 'A cool place' })).toEqual({
      url: 'https://example.com',
      text: 'A cool place',
    });
  });

  it('omits a param that is absent', () => {
    expect(parseShareParams({ url: 'https://example.com' })).toEqual({
      url: 'https://example.com',
    });
  });

  it('treats an empty or whitespace-only param as absent', () => {
    expect(parseShareParams({ url: '   ', text: '' })).toEqual({});
  });

  it('trims surrounding whitespace from the values', () => {
    expect(parseShareParams({ url: '  https://example.com  ', text: '  hi  ' })).toEqual({
      url: 'https://example.com',
      text: 'hi',
    });
  });

  it('takes the first value when a param arrives as an array', () => {
    expect(parseShareParams({ url: ['https://a.com', 'https://b.com'] })).toEqual({
      url: 'https://a.com',
    });
  });
});

describe('classifyShare — generic URL branch', () => {
  it('turns a shared URL into an Activity with the link kept in notes', () => {
    const draft = classifyShare({ url: 'https://maps.example.com/place/42', text: 'Sunset Point' });
    expect(draft.category).toBe('activity');
    expect(draft.notes).toBe('https://maps.example.com/place/42');
  });

  it('names the item from the shared text', () => {
    const draft = classifyShare({ url: 'https://example.com', text: 'Sunset Point' });
    expect(draft.name).toBe('Sunset Point');
  });

  it('uses only the first line of multi-line shared text as the name', () => {
    const draft = classifyShare({ url: 'https://example.com', text: 'Sunset Point\nopen till 9pm' });
    expect(draft.name).toBe('Sunset Point');
  });

  it("falls back to the link's host (without www.) when there is no shared text", () => {
    expect(classifyShare({ url: 'https://www.example.com/place/42' }).name).toBe('example.com');
  });

  it('falls back to the host when the shared text is blank', () => {
    expect(classifyShare({ url: 'https://example.com', text: '   ' }).name).toBe('example.com');
  });
});

describe('defaultCaptureDate', () => {
  const trip = { startDate: '2026-06-10', endDate: '2026-06-20' };

  it('defaults to today when the trip is in progress', () => {
    expect(defaultCaptureDate(trip, '2026-06-13')).toBe('2026-06-13');
  });

  it('counts the first and last day as in progress', () => {
    expect(defaultCaptureDate(trip, '2026-06-10')).toBe('2026-06-10');
    expect(defaultCaptureDate(trip, '2026-06-20')).toBe('2026-06-20');
  });

  it("defaults to the trip's first day when the trip has not started", () => {
    expect(defaultCaptureDate(trip, '2026-06-01')).toBe('2026-06-10');
  });

  it("defaults to the trip's first day when the trip is already past", () => {
    expect(defaultCaptureDate(trip, '2026-07-01')).toBe('2026-06-10');
  });
});
