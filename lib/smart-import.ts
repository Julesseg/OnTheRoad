import { requireOptionalNativeModule } from 'expo';
import { z } from 'zod';
import {
  CURRENT_SCHEMA_VERSION,
  DateString,
  ItemCategorySchema,
  TimeString,
  Trip,
  TripSchema,
} from './schema';
import { newId } from './id';

/**
 * Smart Import core (see CONTEXT.md#smart-import, ADR-0006). The on-device
 * Foundation Models run (issue #97) emits a *draft* trip via guided generation —
 * no UUIDs, no timestamps, no `schemaVersion`, no coordinates, since the model
 * never invents those. This module turns that draft into a persisted Trip: it
 * assigns ids and timestamps deterministically and validates the result through
 * the **same `TripSchema` gate as JSON Import** before the trip is saved.
 *
 * The native generation call is injected (`smartImportTrip`'s `generate` dep),
 * so the post-processing here is unit-testable from JS without a device.
 */

// The draft the model is constrained to emit. A lenient mirror of the persisted
// shape with everything the app assigns stripped out: ids, timestamps,
// schemaVersion, and item coordinates (locations are address text only).
const DraftLocationSchema = z.object({ address: z.string().optional() });

const DraftChecklistItemSchema = z.object({
  label: z.string().min(1),
  checked: z.boolean().default(false),
});

const DraftItemSchema = z.object({
  name: z.string().min(1),
  // Guided generation constrains the *type* of these two, not the enum or HH:mm
  // format — the model can still emit "lodging" or "9am". `.catch` degrades a
  // stray value (category falls back to the 'activity' default below; a bad time
  // is dropped) so one mis-formatted item never rejects the whole multi-day trip.
  category: ItemCategorySchema.optional().catch(undefined),
  time: TimeString.optional().catch(undefined),
  location: DraftLocationSchema.optional(),
  notes: z.string().optional(),
  checklist: z.array(DraftChecklistItemSchema).optional(),
});

const DraftDaySchema = z.object({
  date: DateString,
  items: z.array(DraftItemSchema),
});

export const DraftTripSchema = z.object({
  title: z.string().min(1),
  startDate: DateString,
  endDate: DateString,
  days: z.array(DraftDaySchema),
});

export type DraftTrip = z.infer<typeof DraftTripSchema>;

// The first pass emits only the trip header; the per-day passes fill in items.
// Splitting generation this way (see generateTripDraft) keeps every on-device
// model call far under the ~4k-token context window the whole trip would blow.
const DraftOutlineSchema = DraftTripSchema.pick({ title: true, startDate: true, endDate: true });
const DraftDayItemsSchema = z.object({ items: z.array(DraftItemSchema) });

// A guard against a model that hallucinates a wildly wrong end date turning into
// hundreds of sequential on-device inferences. A real road trip never approaches
// this; beyond it we fail loud rather than grind.
const MAX_TRIP_DAYS = 60;

export interface PostProcessDeps {
  /** Id factory for the trip, days, items, and checklist entries. Defaults to newId. */
  makeId?: () => string;
  /** ISO timestamp stamped on createdAt/updatedAt. Defaults to now. */
  now?: string;
}

export type SmartImportResult = { ok: true; trip: Trip } | { ok: false; error: string };

/**
 * Turn a raw model draft into a persisted Trip. Pure: validates the draft, then
 * app-assigns ids + timestamps and runs the assembled trip through `TripSchema`.
 */
export function draftToTrip(raw: unknown, deps: PostProcessDeps = {}): SmartImportResult {
  const makeId = deps.makeId ?? newId;
  const now = deps.now ?? new Date().toISOString();

  const parsed = DraftTripSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const draft = parsed.data;

  const trip: Trip = {
    id: makeId(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: draft.title,
    startDate: draft.startDate,
    endDate: draft.endDate,
    days: draft.days.map((d) => ({
      id: makeId(),
      date: d.date,
      items: d.items.map((it) => ({
        id: makeId(),
        name: it.name,
        category: it.category ?? 'activity',
        ...(it.time ? { time: it.time } : {}),
        ...(it.location?.address ? { location: { address: it.location.address } } : {}),
        ...(it.notes ? { notes: it.notes } : {}),
        ...(it.checklist
          ? { checklist: it.checklist.map((c) => ({ id: makeId(), label: c.label, checked: c.checked })) }
          : {}),
      })),
    })),
    createdAt: now,
    updatedAt: now,
  };

  // The same gate JSON Import uses — a malformed assembly fails here, not on read.
  const gate = TripSchema.safeParse(trip);
  if (!gate.success) return { ok: false, error: gate.error.issues[0].message };
  return { ok: true, trip: gate.data };
}

/**
 * Every calendar date from `start` to `end` inclusive as "YYYY-MM-DD". Parsed in
 * UTC so adding 24h never trips over a DST boundary. A non-positive or malformed
 * span degrades to a single day (`[start]`) rather than throwing — the assembled
 * draft is still validated downstream; a span over MAX_TRIP_DAYS fails loud.
 */
export function eachDateInclusive(start: string, end: string): string[] {
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return [start];
  const dates: string[] = [];
  for (let t = s; t <= e; t += 86_400_000) {
    if (dates.length >= MAX_TRIP_DAYS) {
      throw new Error(`This plan spans more than ${MAX_TRIP_DAYS} days — too long to import.`);
    }
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

interface NativeGenerateModule {
  /** Guided generation for the trip header only: returns `{title,startDate,endDate}` JSON. */
  generateOutline(text: string): Promise<string>;
  /**
   * Guided generation for ONE day's items: returns `{items:[…]}` JSON.
   * `dayNumber`/`totalDays` (both 1-based, e.g. day 3 of 3) let the model match
   * how the plan labels the day — "Day 3", a weekday, or "March 12" — rather than
   * relying on the ISO `date` alone. When `includeUnscheduled` is true (day one)
   * the model also folds in trip-wide content that has no specific day. Splitting
   * per day keeps each call small enough to fit the on-device context window.
   */
  generateDay(
    text: string,
    date: string,
    dayNumber: number,
    totalDays: number,
    includeUnscheduled: boolean,
  ): Promise<string>;
}

/**
 * The two-phase on-device draft generator (issue #97). The native module is
 * loaded by name and absent off a real device, so this throws there — call sites
 * gate on the availability probe first. Injectable as a whole so the orchestration
 * is unit-testable from JS without a device.
 */
export interface DraftGenerator {
  /** Trip header: title + inclusive start/end dates. */
  outline(text: string): Promise<unknown>;
  /** One day's items; `dayNumber`/`totalDays` are 1-based; `includeUnscheduled` true only for day one. */
  day(
    text: string,
    date: string,
    dayNumber: number,
    totalDays: number,
    includeUnscheduled: boolean,
  ): Promise<unknown>;
}

function nativeGenerator(): DraftGenerator {
  const native = requireOptionalNativeModule<NativeGenerateModule>('SmartImport');
  if (!native) throw new Error('Smart Import is not available on this device.');
  return {
    outline: async (text) => JSON.parse(await native.generateOutline(text)),
    day: async (text, date, dayNumber, totalDays, includeUnscheduled) =>
      JSON.parse(await native.generateDay(text, date, dayNumber, totalDays, includeUnscheduled)),
  };
}

/**
 * Assemble a full draft trip by running the model day-by-day. First the header,
 * then — for each calendar date in the span — that day's items in a fresh, small
 * model call (the whole trip in one call overruns the ~4k-token window). The
 * unscheduled-content rule (packing lists, budgets → day one) is preserved by
 * flagging only the first day. The fail-loud seam: a malformed header here, or a
 * malformed assembly at the `draftToTrip` gate downstream.
 */
export async function generateTripDraft(text: string, gen: DraftGenerator): Promise<unknown> {
  const parsedOutline = DraftOutlineSchema.safeParse(await gen.outline(text));
  if (!parsedOutline.success) throw new Error(parsedOutline.error.issues[0].message);
  const outline = parsedOutline.data;
  const dates = eachDateInclusive(outline.startDate, outline.endDate);

  const days = [];
  for (let i = 0; i < dates.length; i++) {
    const raw = await gen.day(text, dates[i], i + 1, dates.length, i === 0);
    // A day that comes back malformed/empty degrades to no items rather than
    // sinking the whole trip; draftToTrip still validates the final assembly.
    const parsed = DraftDayItemsSchema.safeParse(raw);
    days.push({ date: dates[i], items: parsed.success ? parsed.data.items : [] });
  }

  return { title: outline.title, startDate: outline.startDate, endDate: outline.endDate, days };
}

export interface SmartImportDeps extends PostProcessDeps {
  /** The draft generator. Defaults to the native two-phase call; injectable so
   *  the whole flow is unit-testable from JS without a device. */
  generate?: DraftGenerator;
}

/**
 * The end-to-end Smart Import core: generate a draft from the Planning Document,
 * then post-process it into a persisted-ready Trip (fresh ids, timestamps, the
 * `TripSchema` gate). Throws on a malformed draft so the caller saves nothing.
 */
export async function smartImportTrip(text: string, deps: SmartImportDeps = {}): Promise<Trip> {
  const generate = deps.generate ?? nativeGenerator();
  const draft = await generateTripDraft(text, generate);
  const result = draftToTrip(draft, deps);
  if (!result.ok) throw new Error(result.error);
  return result.trip;
}
