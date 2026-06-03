import { z } from 'zod';

/** Flat string-valued shape backing the trip form; YYYY-MM-DD date strings. */
export interface TripFormValues {
  title: string;
  startDate: string;
  endDate: string;
}

/**
 * Zod schema for the trip form, used as a react-hook-form resolver. Trims the
 * title to a required value and guards the range so the end never precedes the
 * start. YYYY-MM-DD strings compare lexicographically, which matches calendar
 * order, so the range check is a plain string comparison.
 */
export const tripFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Give your trip a title'),
    startDate: z.string(),
    endDate: z.string(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'End date is before the start date',
    path: ['endDate'],
  });

/** Format a Date as a local YYYY-MM-DD string (no UTC drift). */
export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** Parse a YYYY-MM-DD string into a local-midnight Date. */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Move one endpoint of a date range, dragging the other along so `start <= end`
 * always holds: pushing the start past the end pulls the end up to it, and
 * pulling the end before the start drags the start down to it.
 */
export function clampRange(
  endpoint: 'start' | 'end',
  value: string,
  range: { startDate: string; endDate: string },
): { startDate: string; endDate: string } {
  if (endpoint === 'start') {
    return { startDate: value, endDate: value > range.endDate ? value : range.endDate };
  }
  return { startDate: value < range.startDate ? value : range.startDate, endDate: value };
}
