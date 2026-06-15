import { describe, it, expect } from 'vitest';
import type { TripSummary } from './schema';
import {
  APP_GROUP,
  PENDING_CAPTURES_KEY,
  TRIPS_INDEX_KEY,
  buildTripsIndex,
  parsePendingCaptures,
  parseTripsIndex,
  serializePendingCaptures,
  serializeTripsIndex,
  type PendingCapture,
} from './share-bridge';

const trip: TripSummary = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Scotland Highlands',
  startDate: '2026-09-05',
  endDate: '2026-09-07',
};

describe('constants', () => {
  it('names the App Group and the shared UserDefaults keys the Swift side reads/writes', () => {
    expect(APP_GROUP).toBe('group.com.anonymous.on-the-road');
    expect(TRIPS_INDEX_KEY).toBe('tripsIndex');
    expect(PENDING_CAPTURES_KEY).toBe('pendingCaptures');
  });
});

describe('buildTripsIndex', () => {
  it('maps each trip to its title and its inclusive day span for the extension pickers', () => {
    expect(buildTripsIndex([trip])).toEqual([
      {
        id: trip.id,
        title: 'Scotland Highlands',
        dates: ['2026-09-05', '2026-09-06', '2026-09-07'],
      },
    ]);
  });

  it('round-trips through serialize/parse', () => {
    expect(parseTripsIndex(serializeTripsIndex([trip]))).toEqual(buildTripsIndex([trip]));
  });
});

describe('parsePendingCaptures', () => {
  const capture: PendingCapture = {
    url: 'https://maps.apple.com/?q=Eiffel',
    text: 'Eiffel Tower',
    note: 'go at sunset',
    tripId: trip.id,
    date: '2026-09-06',
    capturedAt: '2026-09-01T10:00:00.000Z',
  };

  it('round-trips a queue through serialize/parse', () => {
    expect(parsePendingCaptures(serializePendingCaptures([capture]))).toEqual([capture]);
  });

  it('reads the exact wire format the Swift extension writes', () => {
    // This literal is the contract: ShareViewController.swift writes this JSON
    // string to UserDefaults under PENDING_CAPTURES_KEY.
    const wire =
      '[{"url":"https://maps.apple.com/?q=Eiffel","text":"Eiffel Tower",' +
      '"note":"go at sunset","tripId":"11111111-1111-1111-1111-111111111111",' +
      '"date":"2026-09-06","capturedAt":"2026-09-01T10:00:00.000Z"}]';
    expect(parsePendingCaptures(wire)).toEqual([capture]);
  });

  it('round-trips a capture carrying a picked time', () => {
    const timed: PendingCapture = { ...capture, time: '14:30' };
    expect(parsePendingCaptures(serializePendingCaptures([timed]))).toEqual([timed]);
  });

  it('drops an entry whose time is present but not a string', () => {
    const bad = JSON.stringify([{ ...capture, time: 1430 }]);
    expect(parsePendingCaptures(bad)).toEqual([]);
  });

  it('round-trips a capture carrying a confirmed title', () => {
    const titled: PendingCapture = { ...capture, title: 'Eiffel Tower' };
    expect(parsePendingCaptures(serializePendingCaptures([titled]))).toEqual([titled]);
  });

  it('drops an entry whose title is present but not a string', () => {
    const bad = JSON.stringify([{ ...capture, title: 42 }]);
    expect(parsePendingCaptures(bad)).toEqual([]);
  });

  it('returns an empty queue for null, empty, non-JSON, or non-array input', () => {
    expect(parsePendingCaptures(null)).toEqual([]);
    expect(parsePendingCaptures(undefined)).toEqual([]);
    expect(parsePendingCaptures('')).toEqual([]);
    expect(parsePendingCaptures('not json')).toEqual([]);
    expect(parsePendingCaptures('{"tripId":"x"}')).toEqual([]);
  });

  it('drops malformed entries missing required fields or any shared content', () => {
    const mixed = JSON.stringify([
      capture,
      { tripId: trip.id, date: '2026-09-06', capturedAt: 'x' }, // no url/text
      { url: 'https://x.com', date: '2026-09-06', capturedAt: 'x' }, // no tripId
      { url: 'https://x.com', tripId: trip.id, capturedAt: 'x' }, // no date
    ]);
    expect(parsePendingCaptures(mixed)).toEqual([capture]);
  });
});
