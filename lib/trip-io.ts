import { z } from 'zod';
import { Trip, TripSchema } from './schema';

export type ImportResult =
  | { ok: true; trip: Trip }
  | { ok: false; error: string };

// Turn zod issues into a single user-facing message that names the offending
// field path(s), e.g. "Missing required field: startDate" or
// "days.0.items.0.type: Invalid discriminator value...".
function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.') || '(root)';
      if (issue.code === 'invalid_type' && issue.message.includes('received undefined')) {
        return `Missing required field: ${path}`;
      }
      return `${path}: ${issue.message}`;
    })
    .join('; ');
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
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  const result = TripSchema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: formatIssues(result.error) };
  }
  return { ok: true, trip: { ...result.data, id: freshId } };
}

/** Serialize a trip to pretty-printed JSON suitable for export / sharing. */
export function serializeTrip(trip: Trip): string {
  return JSON.stringify(trip, null, 2);
}
