import { z } from 'zod';
import { Trip, TripSchema } from './schema';
import { migrateTripData } from './trip-migrate';

export type ImportResult =
  | { ok: true; trip: Trip }
  | { ok: false; error: string };

// Walk an object along a zod issue path; returns undefined if any hop is absent.
function valueAtPath(root: unknown, path: PropertyKey[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<PropertyKey, unknown>)[key];
  }
  return cur;
}

// Turn zod issues into a single user-facing message that names the offending
// field path(s), e.g. "Missing required field: startDate" or
// "days.0.items.0.type: Invalid discriminator value...". The missing-field case
// is detected structurally (the value at the path is absent) rather than from
// zod's English message text, so message rewording across zod versions can't
// silently drop the friendly label.
function formatIssues(error: z.ZodError, data: unknown): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.') || '(root)';
      if (issue.code === 'invalid_type' && valueAtPath(data, issue.path) === undefined) {
        return `Missing required field: ${path}`;
      }
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

/**
 * Repair the two corruptions a human-pasted-from-chat JSON blob reliably picks
 * up on iOS — neither of which a real `.json` file suffers, so this is applied
 * only on the paste path:
 *
 *  - **Smart punctuation.** With iOS "Smart Punctuation" on (the default), the
 *    keyboard rewrites the straight double quotes that delimit every JSON string
 *    into typographic “ ” quotes, so `JSON.parse` rejects the whole blob as "not
 *    valid JSON" even though the original was valid. Fold those back to `"`.
 *    Single quotes / apostrophes are left untouched: they're legal inside JSON
 *    strings and trip text legitimately uses ’ (e.g. "Jusqu’à 15h").
 *  - **Markdown code fence.** An LLM that can't emit a downloadable file often
 *    wraps the JSON in a ```json … ``` fence; strip one surrounding fence.
 *
 * Pure and idempotent: clean JSON passes through unchanged.
 */
export function normalizePastedJson(raw: string): string {
  let s = raw.trim();
  // Strip a single surrounding Markdown code fence, keeping the inner body.
  const fenced = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(s);
  if (fenced) s = fenced[1].trim();
  // Fold typographic double quotes back to ASCII so JSON delimiters parse.
  return s.replace(/[“”]/g, '"');
}

/**
 * Parse raw JSON text and validate it against the Trip schema. On success the
 * trip's `id` is replaced by `freshId` so importing never overwrites an
 * existing trip that happens to share the same id. On failure a human-readable
 * error naming the offending field(s) is returned.
 */
export function importTripFromJson(raw: string, freshId: string): ImportResult {
  let data: unknown;
  try {
    data = migrateTripData(JSON.parse(raw));
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  const result = TripSchema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: formatIssues(result.error, data) };
  }
  // Drop wallpaperUri: the image lives on disk under the original trip id and is
  // never part of the JSON export, so the path would dangle after import.
  return { ok: true, trip: { ...result.data, id: freshId, wallpaperUri: undefined } };
}

/** Serialize a trip to pretty-printed JSON suitable for export / sharing. */
export function serializeTrip(trip: Trip): string {
  return JSON.stringify(trip, null, 2);
}
