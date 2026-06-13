import type { ItemCategory } from './schema';

/** The shared payload carried by an `ontheroad://share?url=…&text=…` deep link. */
export interface SharePayload {
  url?: string;
  text?: string;
}

/** The draft Item parts a classified payload yields, before it gets an id/day. */
export interface ShareDraft {
  name: string;
  category: ItemCategory;
  notes?: string;
}

function firstString(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Read the `url` and `text` a Share Capture deep link carries. Expo Router hands
 * query params through as `string | string[] | undefined`; we take the first
 * value, trim it, and drop anything empty so the classifier sees only real input.
 */
export function parseShareParams(
  params: Record<string, string | string[] | undefined>,
): SharePayload {
  const payload: SharePayload = {};
  const url = firstString(params.url);
  const text = firstString(params.text);
  if (url) payload.url = url;
  if (text) payload.text = text;
  return payload;
}

function firstLine(text: string): string {
  return text.split('\n')[0].trim();
}

/** A shared URL's host without a leading `www.`, or the raw URL if it won't parse. */
function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Classify a shared payload into a draft Item. This slice implements only the
 * generic-URL branch (CONTEXT.md → Share Capture): any URL becomes an Activity
 * with the link kept in `notes`, named from the shared text's first line or the
 * link's host as a fallback. The Maps-link and link-less-text branches are later
 * slices — the dispatch below is the seam they slot into.
 */
export function classifyShare(payload: SharePayload): ShareDraft {
  if (payload.url) {
    const fromText = payload.text ? firstLine(payload.text) : '';
    return {
      name: fromText || urlHost(payload.url),
      category: 'activity',
      notes: payload.url,
    };
  }
  // No link: fall back to a Note from the shared text so a capture is never lost.
  // Full link-less-text handling is a later slice.
  return { name: payload.text ? firstLine(payload.text) : 'Shared note', category: 'note' };
}

/**
 * The day a Share Capture lands on by default: today when the destination trip is
 * in progress, otherwise the trip's first day. A trip's first day is always its
 * `startDate` (days span startDate…endDate), so this needs only the trip's dates.
 */
export function defaultCaptureDate(
  trip: { startDate: string; endDate: string },
  today: string,
): string {
  if (trip.startDate <= today && today <= trip.endDate) return today;
  return trip.startDate;
}
