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

interface NativeGenerateModule {
  /**
   * Run the on-device model with guided generation constrained to the draft
   * schema and return the draft as a JSON string. Async: inference is slow.
   */
  generate(text: string): Promise<string>;
}

/**
 * Invoke the native Foundation Models generation (issue #97) for one Planning
 * Document and parse its draft JSON. The native module is loaded by name and is
 * absent off a real device, so this throws there — call sites gate on the
 * availability probe first. The thrown/JSON-parse failure is the fail-loud seam.
 */
export async function generateTripDraft(text: string): Promise<unknown> {
  const native = requireOptionalNativeModule<NativeGenerateModule>('SmartImport');
  if (!native) throw new Error('Smart Import is not available on this device.');
  return JSON.parse(await native.generate(text));
}

export interface SmartImportDeps extends PostProcessDeps {
  /** The draft generator. Defaults to the native call; injectable so the whole
   *  flow is unit-testable from JS without a device. */
  generate?: (text: string) => Promise<unknown>;
}

/**
 * The end-to-end Smart Import core: generate a draft from the Planning Document,
 * then post-process it into a persisted-ready Trip (fresh ids, timestamps, the
 * `TripSchema` gate). Throws on a malformed draft so the caller saves nothing.
 */
export async function smartImportTrip(text: string, deps: SmartImportDeps = {}): Promise<Trip> {
  const generate = deps.generate ?? generateTripDraft;
  const draft = await generate(text);
  const result = draftToTrip(draft, deps);
  if (!result.ok) throw new Error(result.error);
  return result.trip;
}
