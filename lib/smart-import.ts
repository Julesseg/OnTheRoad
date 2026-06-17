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
export type DraftItem = z.infer<typeof DraftItemSchema>;

/**
 * A draft from a Planning Document that carries no calendar dates — the plan said
 * "Day 1 / Day 2" or gave no dates at all, so the model signalled "no dates found"
 * (see CONTEXT.md#smart-import) instead of inventing some. Its days are in order
 * but date-less; `anchorDraft` pins them to real dates once the user picks a start.
 */
export interface UndatedDraft {
  title: string;
  days: { items: DraftItem[] }[];
}

// The first pass emits only the trip header; the per-day passes fill in items.
// Splitting generation this way (see generateTripDraft) keeps every on-device
// model call far under the ~4k-token context window the whole trip would blow.
//
// The header comes back in one of two shapes. A *dated* outline carries the real
// calendar span the plan states. An *undated* outline is the model signalling "no
// dates found" (the plan said "Day 1 / Day 2", or nothing) — it reports only how
// many days the plan spans, never invented dates (CONTEXT.md#smart-import); the
// flow asks the user for a start date and `anchorDraft` pins the days to it.
const DatedOutlineSchema = DraftTripSchema.pick({ title: true, startDate: true, endDate: true });
const UndatedOutlineSchema = z.object({
  title: z.string().min(1),
  dayCount: z.number().int().positive().catch(1),
});
const DraftDayItemsSchema = z.object({ items: z.array(DraftItemSchema) });

// A guard against a model that hallucinates a wildly wrong end date turning into
// hundreds of sequential on-device inferences. A real road trip never approaches
// this; beyond it we fail loud rather than grind.
const MAX_TRIP_DAYS = 60;

const MONTHS =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

// Deterministic backstop for the on-device model's date judgement. Apple's small
// model sometimes sets hasDates=true and *invents* a calendar span for a plan that
// states none ("Day 1 / Day 2"), defeating the inline start-date prompt (issue #98)
// — a wrong date is worse than none (CONTEXT.md#smart-import). A document can only
// truly carry dates if it actually names one, so these patterns let us veto a
// "dated" outline the source text can't support. Conservative on purpose: a bare
// month word ("may need to…") or a lone "the 18th" is not enough — a date needs a
// month next to a day, an ISO date, or a numeric date.
const CALENDAR_DATE_PATTERNS: RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}\b/, // ISO: 2026-08-14
  new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'i'), // March 10, Apr 20th
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTHS})\\b`, 'i'), // 18 April, 18th of April
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/, // 8/14, 08/14/2026
];

/**
 * Whether the Planning Document actually states a calendar date — a real month+day,
 * an ISO date, or a numeric date. The deterministic veto over the on-device model's
 * `hasDates` claim (issue #98): if the text names no date, the model can't have a
 * real span, so the flow must ask the user for a start date instead of trusting an
 * invented one.
 */
export function documentStatesCalendarDate(text: string): boolean {
  return CALENDAR_DATE_PATTERNS.some((re) => re.test(text));
}

/**
 * Strip bare URLs from a Planning Document before on-device generation. Two payoffs,
 * one cause: Apple's Foundation Models safety guardrail frequently rejects link-heavy
 * text outright ("Detected content likely to be unsafe"), and the model captures
 * address *text* only (ADR-0006) so it drops every URL regardless — the links are pure
 * liability. Removing them leaves the structured output unchanged while keeping a pasted
 * link dump importable on-device. Strips `http(s)://` and bare `www.` links, then tidies
 * the separator a removed link leaves stranded — a dangling "— " at a line end, or a
 * link sitting between two dashes — so place names and reminders still read cleanly.
 */
export function stripUrls(text: string): string {
  return text
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '')
    // A link removed from between two dashes ("Narisawa —  — note") collapses to one.
    .replace(/([—–-])\s+\1/g, '$1')
    // A link removed from a line's end leaves a trailing dash ("Toyosu — ") — drop it.
    .replace(/[ \t]*[—–-][ \t]*$/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '');
}

/**
 * Split a Planning Document into the units segmentation assigns to days. Breaks on
 * line boundaries and on sentence/clause separators (`.!?;` and a spaced em/en dash),
 * so "Saturday is the big one: …" stays one unit while "Friday …", "Saturday …" and
 * "Sunday …" land as separate units. Deliberately granular: over-splitting is safe —
 * same-day fragments are rejoined into one slice by {@link assembleDaySlices} — while
 * under-splitting would trap two days' content in one indivisible unit.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?;])\s+|\s+[—–]\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Reassemble per-day slices from a sentence list and the day each sentence was assigned
 * to (1..dayCount, or anything else — 0, out of range, missing — meaning trip-wide).
 * Trip-wide sentences fold into day one. Every sentence lands in exactly one slice, so
 * nothing is dropped and nothing is duplicated across days: the structural guarantee the
 * segment-then-extract flow rests on (each per-day extraction then sees only its slice).
 */
export function assembleDaySlices(sentences: string[], assignment: number[], dayCount: number): string[] {
  const a = Array.isArray(assignment) ? assignment : [];
  const buckets: string[][] = Array.from({ length: Math.max(dayCount, 1) }, () => []);
  sentences.forEach((sentence, i) => {
    const day = a[i];
    const idx =
      typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= dayCount ? day - 1 : 0;
    buckets[idx].push(sentence);
  });
  return buckets.map((b) => b.join(' '));
}

// A day header sitting at the very start of a paragraph: an explicit "Day N", a
// weekday, a month name, or a numeric date. These are how the structured plans open
// each day's paragraph ("Day 2 — Saturday, Oct 3:", "Mon Apr 20:", "Friday Apr 24 —").
const WEEKDAY =
  '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues|tue|weds|wed|thurs|thur|thu|fri|sat|sun)';
const DAY_HEADER_RE = new RegExp(
  `^(?:day\\s+\\d+\\b|${WEEKDAY}\\b|(?:${MONTHS})\\b|\\d{1,2}\\/\\d{1,2}\\b)`,
  'i',
);

/**
 * Deterministically slice a plan by its own paragraph structure, the reliable signal
 * the model segmentation throws away. Structured plans put each day in its own
 * blank-line-separated paragraph that opens with a day header ("Day 2 — …", "Mon Apr
 * 20:", "Friday …"); the lead paragraphs before the first header (title, "Before we
 * go", packing) are trip-wide and fold into day one.
 *
 * Used only when the paragraphs line up one-to-one with `dayCount` — exactly as many
 * day-opening paragraphs as days. That exact match is the confidence gate: a plan whose
 * days run together in one paragraph (prose) or that has stray paragraphs won't match,
 * and `null` hands the decision to the model. Days are taken in document order (an
 * itinerary always lists them in order), so the headers' own numbers/labels — which
 * real plans muddle ("Day 7-ish", a bare weekday) — never have to be trusted.
 */
export function segmentByParagraphs(text: string, dayCount: number): string[] | null {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const dayParagraphs = paragraphs.filter((p) => DAY_HEADER_RE.test(p));
  if (dayCount < 1 || dayParagraphs.length !== dayCount) return null;

  const buckets: string[][] = Array.from({ length: dayCount }, () => []);
  let current = -1; // before the first day header: trip-wide, folds into day one
  for (const p of paragraphs) {
    if (DAY_HEADER_RE.test(p)) current += 1;
    buckets[current < 0 ? 0 : current].push(p);
  }
  return buckets.map((parts) => parts.join('\n\n'));
}

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
        // Only a non-empty checklist: the on-device model often tacks an empty
        // `checklist: []` onto ordinary items, which would otherwise persist as noise.
        ...(it.checklist && it.checklist.length > 0
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
 * `count` consecutive calendar dates starting at `start`, as "YYYY-MM-DD". Parsed
 * in UTC so adding 24h never trips over a DST boundary. An unparseable start
 * degrades to `[start]`; the assembled draft is still validated downstream.
 */
function datesFromStart(start: string, count: number): string[] {
  const s = Date.parse(`${start}T00:00:00Z`);
  if (Number.isNaN(s)) return [start];
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    dates.push(new Date(s + i * 86_400_000).toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Pin an {@link UndatedDraft} to real calendar dates: its days run consecutively
 * from `startDate`, every item kept in place. The result is a dated {@link DraftTrip}
 * ready for `draftToTrip`. Pure and device-free — the unit-testable heart of the
 * inline start-date flow (issue #98): placeholder dates are never persisted, so the
 * calendar-anchored Day reconciliation (PR #94 decision 3) never drops a real item.
 */
export function anchorDraft(draft: UndatedDraft, startDate: string): DraftTrip {
  const dates = datesFromStart(startDate, Math.max(draft.days.length, 1));
  return {
    title: draft.title,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    days: draft.days.map((d, i) => ({ date: dates[i], items: d.items })),
  };
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
   * Guided generation for day segmentation: given the plan's sentences numbered 1..K
   * and the day count, returns a JSON array of K integers — the day (1..N) each
   * sentence belongs to, or 0 for trip-wide. One small call partitions the plan so
   * each per-day extraction sees only its own text.
   */
  segmentDays(text: string, dayCount: number): Promise<string>;
  /**
   * Guided generation for ONE day's items: returns `{items:[…]}` JSON. The `text`
   * passed is already this day's slice (see segmentDays), so the model only extracts —
   * it never has to attribute content across days. `dayNumber`/`totalDays` (both
   * 1-based) label the day; when `includeUnscheduled` is true (day one) the model
   * gathers the trip-wide to-dos folded into this slice as a checklist.
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
 * The on-device draft generator (issue #97). The native module is loaded by name and
 * absent off a real device, so this throws there — call sites gate on the availability
 * probe first. Injectable as a whole so the orchestration is unit-testable from JS
 * without a device.
 */
export interface DraftGenerator {
  /** Trip header: title + inclusive start/end dates. */
  outline(text: string): Promise<unknown>;
  /** Day each numbered sentence belongs to (1..dayCount, or 0/other for trip-wide). */
  segment(text: string, dayCount: number): Promise<number[]>;
  /** One day's items from its slice; `dayNumber`/`totalDays` are 1-based; `includeUnscheduled` true only for day one. */
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
    segment: async (text, dayCount) => JSON.parse(await native.segmentDays(text, dayCount)),
    day: async (text, date, dayNumber, totalDays, includeUnscheduled) =>
      JSON.parse(await native.generateDay(text, date, dayNumber, totalDays, includeUnscheduled)),
  };
}

/**
 * Partition the plan into one text slice per day, so each per-day extraction sees only
 * its own content — the cross-day duplication and bleed of re-reading the whole document
 * for every day can't happen. A one-day trip needs no split.
 *
 * Prefer the plan's own paragraph structure ({@link segmentByParagraphs}): it is exact
 * and free, and a small model proved unreliable here — asked to assign ~25 sentences it
 * collapsed every one onto day one. The model segmentation is the fallback for plans with
 * no clean day-per-paragraph structure (days run together in prose). Either way, trip-wide
 * content folds into day one.
 */
async function segmentIntoSlices(text: string, gen: DraftGenerator, dayCount: number): Promise<string[]> {
  if (dayCount <= 1) return [text];
  const byParagraph = segmentByParagraphs(text, dayCount);
  if (byParagraph) return byParagraph;
  const sentences = splitSentences(text);
  if (sentences.length === 0) return Array.from({ length: dayCount }, () => '');
  const numbered = sentences.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const assignment = await gen.segment(numbered, dayCount);
  return assembleDaySlices(sentences, assignment, dayCount);
}

/**
 * A generated draft, tagged with whether the flow still needs a start date from
 * the user. A *dated* plan came back anchored to real dates; an *undated* one (the
 * model found no dates) yields date-less days that `anchorDraft` pins once a start
 * is chosen (issue #98).
 */
export type GeneratedDraft =
  | { needsStartDate: false; draft: DraftTrip }
  | { needsStartDate: true; draft: UndatedDraft };

/** One day's items from the model, degrading a malformed/empty result to no items
 *  rather than sinking the whole trip; `draftToTrip` still validates the assembly.
 *
 *  An empty slice never reaches the model: segmentation can leave a day with no
 *  sentences (every one landed on another day), and a small model told to "extract
 *  day N of M" from blank text does not answer "nothing" — it hallucinates a
 *  plausible generic day, inventing places the plan never named and tacking a
 *  checklist onto each invented item. An empty day is honest; a fabricated one is
 *  actively wrong, so we short-circuit to no items rather than ask. */
async function generateDayItems(
  text: string,
  gen: DraftGenerator,
  date: string,
  dayNumber: number,
  totalDays: number,
): Promise<{ items: DraftItem[] }> {
  if (text.trim().length === 0) return { items: [] };
  const raw = await gen.day(text, date, dayNumber, totalDays, dayNumber === 1);
  const parsed = DraftDayItemsSchema.safeParse(raw);
  return { items: parsed.success ? parsed.data.items : [] };
}

/**
 * Assemble a draft trip by running the model in stages. First the header, then one
 * segmentation call that partitions the plan into a text slice per day (so no single
 * call has to hold the whole trip — the ~4k-token window — and, crucially, no day
 * re-reads another day's content), then for each day a small extraction call over
 * that day's slice alone. Trip-wide content (packing lists, budgets) folds into day
 * one's slice, where the day-one extraction gathers it as a checklist.
 *
 * The header decides the shape: a *dated* outline drives one call per calendar date
 * in its span; an *undated* one drives one call per relative day — no date to key on,
 * so each call leans on dayNumber/totalDays — and returns date-less days for
 * `anchorDraft` to pin later.
 *
 * A dated outline is trusted only when the document actually states a date
 * (`documentStatesCalendarDate`): the on-device model sometimes fabricates a span
 * for a plan that has none, so a "dated" outline over a date-less document is
 * demoted to the undated path (its span length kept as the day count, the invented
 * dates discarded) and the flow asks the user for a start date (issue #98). The
 * fail-loud seam: a malformed header here, or a malformed assembly at the
 * `draftToTrip` gate downstream.
 */
export async function generateTripDraft(text: string, gen: DraftGenerator): Promise<GeneratedDraft> {
  const rawOutline = await gen.outline(text);

  const dated = DatedOutlineSchema.safeParse(rawOutline);
  if (dated.success && documentStatesCalendarDate(text)) {
    const outline = dated.data;
    const dates = eachDateInclusive(outline.startDate, outline.endDate);
    const slices = await segmentIntoSlices(text, gen, dates.length);
    const days = [];
    for (let i = 0; i < dates.length; i++) {
      const { items } = await generateDayItems(slices[i], gen, dates[i], i + 1, dates.length);
      days.push({ date: dates[i], items });
    }
    return {
      needsStartDate: false,
      draft: { title: outline.title, startDate: outline.startDate, endDate: outline.endDate, days },
    };
  }

  // Undated: the model either signalled "no dates found" (a day count) or fabricated
  // a span the document never states (we keep its day span as the count and drop the
  // invented dates). Either way the days are date-less and the flow prompts for a start.
  let title: string;
  let dayCount: number;
  if (dated.success) {
    // Reaching here with a dated outline means the document had no dates (the
    // real-dates path returned above), so the span is invented — keep only its length.
    title = dated.data.title;
    dayCount = eachDateInclusive(dated.data.startDate, dated.data.endDate).length;
  } else {
    // UndatedOutlineSchema's dayCount .catch(1) makes it parse almost anything, so it
    // is only meaningful once the dated shape is ruled out.
    const undated = UndatedOutlineSchema.safeParse(rawOutline);
    if (!undated.success) throw new Error(undated.error.issues[0].message);
    title = undated.data.title;
    dayCount = undated.data.dayCount;
  }

  // Cap before generating so a hallucinated day count can't trigger hundreds of
  // sequential on-device inferences — the same guard eachDateInclusive applies.
  if (dayCount > MAX_TRIP_DAYS) {
    throw new Error(`This plan spans more than ${MAX_TRIP_DAYS} days — too long to import.`);
  }
  const slices = await segmentIntoSlices(text, gen, dayCount);
  const days = [];
  for (let i = 0; i < dayCount; i++) {
    // No calendar date yet, so the per-day call leans on dayNumber/totalDays.
    const { items } = await generateDayItems(slices[i], gen, '', i + 1, dayCount);
    days.push({ items });
  }
  return { needsStartDate: true, draft: { title, days } };
}

export interface SmartImportDeps extends PostProcessDeps {
  /** The draft generator. Defaults to the native two-phase call; injectable so
   *  the whole flow is unit-testable from JS without a device. */
  generate?: DraftGenerator;
  /**
   * Asked for a trip start date ("YYYY-MM-DD") when the Planning Document carries
   * no calendar dates, so the days can be anchored before saving (issue #98).
   * Resolving `null` aborts the import with nothing saved. The default throws —
   * there is no UI in this layer — so a caller that may hit a dateless document
   * must supply it (the Smart Import screen does, with an inline date picker).
   */
  promptStartDate?: () => Promise<string | null>;
}

/**
 * The end-to-end Smart Import core: generate a draft from the Planning Document,
 * then post-process it into a persisted-ready Trip (fresh ids, timestamps, the
 * `TripSchema` gate). When the document has no calendar dates, ask for a start
 * date (`promptStartDate`) and anchor the days to it first — never placeholder
 * dates, which the calendar-anchored Day reconciliation would punish (PR #94
 * decision 3). Returns `null` when that prompt is cancelled (nothing saved);
 * throws on a malformed draft so the caller saves nothing either way.
 */
export async function smartImportTrip(text: string, deps: SmartImportDeps = {}): Promise<Trip | null> {
  const generate = deps.generate ?? nativeGenerator();
  // Sanitize before the model sees it: bare URLs trip Apple's safety guardrail and
  // are dropped by the address-text-only capture anyway (see stripUrls).
  const generated = await generateTripDraft(stripUrls(text), generate);

  let draft: DraftTrip;
  if (generated.needsStartDate) {
    const promptStartDate =
      deps.promptStartDate ??
      (() => {
        throw new Error('This plan has no dates — a start date is required to import it.');
      });
    const startDate = await promptStartDate();
    if (startDate == null) return null;
    draft = anchorDraft(generated.draft, startDate);
  } else {
    draft = generated.draft;
  }

  const result = draftToTrip(draft, deps);
  if (!result.ok) throw new Error(result.error);
  return result.trip;
}
