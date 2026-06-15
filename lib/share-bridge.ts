import type { TripSummary } from './schema';
import { datesInRange } from './trip-days';
import { resolveActiveTrip } from './active-trip';

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

/**
 * Project the in-memory trip summaries into the picker index the extension reads.
 * Archived (past) trips are dropped — the extension captures only onto a live trip,
 * matching the in-app destination rules — and the resolved default trip (the
 * favorite, else the current/next trip; the same one the app displays by default)
 * is placed first so the extension, whose picker defaults to the first entry, lands
 * on that trip without needing the favorite logic in Swift.
 */
export function buildTripsIndex(
  trips: TripSummary[],
  activeTripId: string | null,
  today: string,
): TripIndexEntry[] {
  const active = trips.filter((t) => t.endDate >= today);
  const defaultId = resolveActiveTrip(trips, activeTripId, today).tripId;
  const byStart = (a: TripSummary, b: TripSummary) => a.startDate.localeCompare(b.startDate);
  const def = active.find((t) => t.id === defaultId);
  const rest = active.filter((t) => t.id !== defaultId).sort(byStart);
  const ordered = def ? [def, ...rest] : rest;
  return ordered.map((t) => ({
    id: t.id,
    title: t.title,
    dates: datesInRange(t.startDate, t.endDate),
  }));
}

export function serializeTripsIndex(
  trips: TripSummary[],
  activeTripId: string | null,
  today: string,
): string {
  return JSON.stringify(buildTripsIndex(trips, activeTripId, today));
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
