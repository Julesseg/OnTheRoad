import type { TripSummary } from './schema';
import { datesInRange } from './trip-days';

// The wire contract between the native iOS Share Extension and the app (ADR-0008).
// The extension can't open the host app on iOS 18+, so instead of a deep link it
// hands data off through a shared App Group `UserDefaults` suite: the app mirrors a
// `tripsIndex` for the extension's pickers, and the extension appends captures to a
// `pendingCaptures` queue the app drains in the background on next foreground.
// `targets/share/ShareViewController.swift` reads/writes these exact keys and JSON
// shapes — this module is the canonical spec the round-trip tests pin both sides to.

/** App Group container shared between the app and the Share Extension. */
export const APP_GROUP = 'group.com.anonymous.on-the-road';

/** UserDefaults key the app writes and the extension reads. */
export const TRIPS_INDEX_KEY = 'tripsIndex';
/** UserDefaults key the extension appends to and the app reads + clears. */
export const PENDING_CAPTURES_KEY = 'pendingCaptures';

/** One trip as the extension's Trip + Day pickers need it. */
export interface TripIndexEntry {
  id: string;
  title: string;
  /** Inclusive YYYY-MM-DD span — exactly the dates the Day picker offers. */
  dates: string[];
}

/** A capture the extension queued for the app to ingest in the background. */
export interface PendingCapture {
  url?: string;
  text?: string;
  /** The item title the user confirmed in the share sheet (prefilled from the
   * shared content). When set it overrides the name the classifier would derive. */
  title?: string;
  /** The free-text note the user typed in the share sheet, if any. */
  note?: string;
  /** The trip the user picked in the extension. */
  tripId: string;
  /** The day the user picked, YYYY-MM-DD. */
  date: string;
  /** The time the user picked in the extension, HH:mm. Absent leaves the item untimed. */
  time?: string;
  /** ISO8601 capture time, so the app drains the queue oldest-first. */
  capturedAt: string;
}

/** Project the in-memory trip summaries into the picker index the extension reads. */
export function buildTripsIndex(trips: TripSummary[]): TripIndexEntry[] {
  return trips.map((t) => ({
    id: t.id,
    title: t.title,
    dates: datesInRange(t.startDate, t.endDate),
  }));
}

export function serializeTripsIndex(trips: TripSummary[]): string {
  return JSON.stringify(buildTripsIndex(trips));
}

export function parseTripsIndex(json: string | null | undefined): TripIndexEntry[] {
  if (!json) return [];
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function serializePendingCaptures(captures: PendingCapture[]): string {
  return JSON.stringify(captures);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** A queued capture is only usable if it names a trip + day and carries content. */
function isPendingCapture(value: unknown): value is PendingCapture {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!isString(c.tripId) || !isString(c.date) || !isString(c.capturedAt)) return false;
  if (c.time !== undefined && !isString(c.time)) return false;
  if (c.title !== undefined && !isString(c.title)) return false;
  return isString(c.url) || isString(c.text);
}

/**
 * Decode the extension's queue, dropping anything malformed so one bad write can't
 * crash the drain. Tolerates null/empty/non-JSON input (e.g. an empty suite).
 */
export function parsePendingCaptures(json: string | null | undefined): PendingCapture[] {
  if (!json) return [];
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) return [];
    return data.filter(isPendingCapture);
  } catch {
    return [];
  }
}
