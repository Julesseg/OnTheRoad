import ExpoModulesCore

#if canImport(FoundationModels)
import FoundationModels
#endif

// On-device Smart Import generation (issue #97, ADR-0006). Runs Apple's
// Foundation Models with GUIDED GENERATION — no UUIDs, timestamps, schemaVersion,
// or coordinates, since the model never invents those. The app
// (lib/smart-import.ts) assigns ids + timestamps and validates through the same
// TripSchema gate as JSON Import. Reads nothing from the network: inference is
// entirely local.
//
// Generation is split into two passes so no single model call overruns the
// ~4k-token context window the whole trip would blow (the cause of
// exceededContextWindowSize even on tiny plans): `generateOutline` returns just
// the trip header, then JS calls `generateDay` once per calendar date for that
// day's items. Each call's instructions + schema + document + output stay small.
//
// Registered under the name "SmartImport"; the JS wrapper loads it with
// requireOptionalNativeModule and only calls it once the availability probe
// (SmartImportAvailability) reports the model is available.
public class SmartImportModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SmartImport")

    // Async: on-device inference is slow. Throws on an unsupported OS or an
    // unavailable model; surfaces to JS as a rejected promise so the flow fails
    // loud and saves nothing (CONTEXT.md#smart-import).

    // Pass 1 — the trip header only: `{title,startDate,endDate}` JSON.
    AsyncFunction("generateOutline") { (text: String) async throws -> String in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        return try await generateOutlineJSON(from: text)
      }
      #endif
      throw SmartImportError.unsupported
    }

    // Pass 2 — segmentation: given the plan's sentences numbered 1..K and the day
    // count, return a JSON array of K integers, the day (1..N) each sentence belongs
    // to (0 for trip-wide). One call partitions the plan so each per-day extraction
    // sees only its own text — the cure for cross-day duplication and bleed.
    AsyncFunction("segmentDays") { (text: String, dayCount: Int) async throws -> String in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        return try await segmentDaysJSON(from: text, dayCount: dayCount)
      }
      #endif
      throw SmartImportError.unsupported
    }

    // Pass 3 — one day's items: `{items:[…]}` JSON. `text` is already this day's
    // slice (see segmentDays), so the model only extracts; `dayNumber`/`totalDays`
    // (both 1-based) label the day; `includeUnscheduled` (day one only) gathers the
    // trip-wide to-dos folded into the slice as a checklist.
    AsyncFunction("generateDay") { (text: String, date: String, dayNumber: Int, totalDays: Int, includeUnscheduled: Bool) async throws -> String in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        return try await generateDayJSON(
          from: text,
          date: date,
          dayNumber: dayNumber,
          totalDays: totalDays,
          includeUnscheduled: includeUnscheduled
        )
      }
      #endif
      throw SmartImportError.unsupported
    }
  }
}

enum SmartImportError: Error, LocalizedError {
  case unsupported
  // Apple's Foundation Models safety guardrail rejected the document. Link-heavy
  // text (a dump of map URLs) is a common false positive; the guardrail can't be
  // disabled, so we translate its opaque "Detected content likely to be unsafe"
  // into a message that points the user at the off-device Schema Prompt instead.
  case unsafeContent

  var errorDescription: String? {
    switch self {
    case .unsupported:
      return "Smart Import isn’t available on this device."
    case .unsafeContent:
      return "Apple Intelligence flagged this plan as unsafe to structure on-device. Try the Schema Prompt to run it through another AI instead."
    }
  }
}

#if canImport(FoundationModels)
// Translate Apple's guardrail rejection into our own domain error; pass anything
// else (a too-long context, a decode failure) through unchanged to fail loud.
@available(iOS 26.0, *)
private func mapGenerationError(_ error: Error) -> Error {
  if let generationError = error as? LanguageModelSession.GenerationError,
     case .guardrailViolation = generationError {
    return SmartImportError.unsafeContent
  }
  return error
}

// Pass 1: just the trip header. Tiny output, so it never strains the window.
@available(iOS 26.0, *)
private func generateOutlineJSON(from document: String) async throws -> String {
  let instructions = """
  You read a free-text trip plan for a travel app and return its header: a short \
  trip title, and either the trip's real calendar dates or — when it has none — \
  how many days it spans.

  Dates: use ONLY calendar dates the plan actually states (a month and day, or a \
  full date). If the plan gives real dates, set hasDates to true and fill in the \
  inclusive start and end as "YYYY-MM-DD" (a single-day plan uses that one date \
  for both). If the plan uses only relative days ("Day 1", "Day 2") or gives no \
  dates at all, set hasDates to false, leave startDate and endDate empty, and set \
  dayCount to how many days the plan spans. NEVER invent, guess, or estimate a \
  calendar date — a wrong date is worse than none, so when in doubt set hasDates \
  to false.
  """

  let session = LanguageModelSession(instructions: instructions)
  let outline: TripOutline
  do {
    outline = try await session.respond(to: document, generating: TripOutline.self).content
  } catch {
    throw mapGenerationError(error)
  }

  // Two header shapes (see lib/smart-import.ts): a dated outline carries the real
  // span; an undated one reports only a day count, the signal that the plan had no
  // dates so the app must ask the user for a start date before saving.
  let payload: [String: Any] = outline.hasDates
    ? ["title": outline.title, "startDate": outline.startDate, "endDate": outline.endDate]
    : ["title": outline.title, "dayCount": max(1, outline.dayCount)]
  let data = try JSONSerialization.data(withJSONObject: payload)
  return String(decoding: data, as: UTF8.self)
}

// Pass 2: segment the plan. The input is the plan's sentences numbered 1..K; the
// output is one day number per sentence (1..N, or 0 for trip-wide). Keeping this a
// pure routing decision — not extraction — lets the small model assign each sentence
// once, after which every per-day call sees only its own slice, so nothing duplicates
// across days and nothing is dropped (JS reassembles the slices deterministically).
@available(iOS 26.0, *)
private func segmentDaysJSON(from numberedSentences: String, dayCount: Int) async throws -> String {
  let instructions = """
  You are given a numbered list of sentences from a trip plan that spans \(dayCount) \
  days. For EACH sentence, decide which day it belongs to and output that day's number \
  (1 to \(dayCount)). Output 0 only when a sentence is trip-wide and belongs to no single \
  day — a packing list, a budget, a general pre-trip errand.

  Use the plan's own day cues: a sentence under "Day 2", a weekday, or a date goes to \
  that day. A booking or reminder that names a day belongs to that day — "book the \
  Saturday crossing" goes to whichever day is Saturday, not day 1. Assign every \
  sentence to exactly one day; output one integer per sentence, in the same order, and \
  nothing else.
  """

  let session = LanguageModelSession(instructions: instructions)
  let prompt = "Sentences:\n\(numberedSentences)"
  let result: Segmentation
  do {
    result = try await session.respond(to: prompt, generating: Segmentation.self).content
  } catch {
    throw mapGenerationError(error)
  }

  let data = try JSONSerialization.data(withJSONObject: result.dayForSentence)
  return String(decoding: data, as: UTF8.self)
}

// Pass 2: the items for one calendar date. A capped response budget is belt-and-
// suspenders — per-day output is small, but a pathological day can't run away
// and overrun the window.
@available(iOS 26.0, *)
private func generateDayJSON(
  from document: String,
  date: String,
  dayNumber: Int,
  totalDays: Int,
  includeUnscheduled: Bool
) async throws -> String {
  var instructions = """
  You extract every item from ONE day's portion of a trip plan.

  The text below is the part of the plan for a single day (day \(dayNumber) of \
  \(totalDays)) — it has already been separated out for you, so you do not have to \
  decide which day anything belongs to. Capture EVERY item it mentions — each activity, \
  meal, place, check-in, and reminder, even short ones. Do not skip or merge items. For \
  each item, fill in detail ONLY from what the text actually says: never invent or guess \
  a time, place, name, or activity that is not written. Capturing a stated item with a \
  missing field is right; adding a plausible-sounding field is wrong. Return an empty \
  list only if the text truly describes nothing to do.

  Rules:
  - time: include a time ONLY when the plan states a clock time for that item, \
  converted to 24-hour "HH:mm" (9:30am → "09:30", 8pm → "20:00", 11am → "11:00", 6pm \
  → "18:00", noon → "12:00", midnight → "00:00"). A midday time reads as afternoon: \
  lunch or dinner "around 1" is "13:00", not "01:00". If the plan gives NO clock time \
  for an item, you MUST omit the time field — never infer one from the order of \
  events, the part of the day, or a meal, and never fall back to "00:00" or any other \
  placeholder. Most items have no stated time; leaving time off is the common case.
  - category is one of: activity, location, stay, meal, note (stay for lodging, meal \
  for food, location for a place to see, activity for things to do, note for \
  reminders); default to activity when unsure.
  - location/address: include only a place or address the plan actually names, as \
  address TEXT ONLY — never latitude/longitude. Never invent or complete an address. \
  Omit it when the plan names no place.
  - A reminder or booking ("book the ferry", "reserve the clambake") is a note item — \
  capture it like anything else in the text.
  - Packing and to-do lists become a checklist (one entry per line) only when there is \
  more than one item.
  """
  if includeUnscheduled {
    instructions += """

    - This day's text also carries the trip's general pre-trip to-dos (packing items, a \
    budget, errands like "oil change before we go" or "pack the cooler"). Gather those \
    general to-dos into a SINGLE note item with a checklist, one entry each, rather than \
    many separate notes. Capture them all — drop none.
    """
  }

  let session = LanguageModelSession(instructions: instructions)
  let prompt = "Here is the plan for this day:\n\(document)"
  let options = GenerationOptions(maximumResponseTokens: 2000)
  let day: DayItems
  do {
    day = try await session.respond(to: prompt, generating: DayItems.self, options: options).content
  } catch {
    throw mapGenerationError(error)
  }

  // Serialize to the shape lib/smart-import.ts expects — notably address is
  // nested under `location`, not a flat field.
  let payload: [String: Any] = [
    "items": day.items.map { item -> [String: Any] in
      var out: [String: Any] = ["name": item.name]
      if let category = item.category { out["category"] = category }
      if let time = item.time { out["time"] = time }
      if let address = item.address, !address.isEmpty {
        out["location"] = ["address": address]
      }
      if let notes = item.notes { out["notes"] = notes }
      if let checklist = item.checklist {
        out["checklist"] = checklist.map { ["label": $0.label, "checked": $0.checked] }
      }
      return out
    },
  ]

  let data = try JSONSerialization.data(withJSONObject: payload)
  return String(decoding: data, as: UTF8.self)
}

// The guided-generation schemas. @Generable constrains decoding so the model can
// only emit a valid shape; @Guide steers each field. These mirror the per-pass
// draft shapes in lib/smart-import.ts (address is flat here for cleaner
// generation, then nested under `location` when serialized above).
@available(iOS 26.0, *)
@Generable
struct TripOutline {
  @Guide(description: "A short title for the trip")
  let title: String
  @Guide(description: "true ONLY if the plan states real calendar dates (a month and day, or a full date); false if it uses only relative days like 'Day 1'/'Day 2' or gives no dates at all")
  let hasDates: Bool
  @Guide(description: "When hasDates is true, the trip's first calendar date formatted YYYY-MM-DD; otherwise the empty string. Never invent a date.")
  let startDate: String
  @Guide(description: "When hasDates is true, the trip's last calendar date inclusive, formatted YYYY-MM-DD; otherwise the empty string. Never invent a date.")
  let endDate: String
  @Guide(description: "How many days the plan spans, at least 1 (a 'Day 1 / Day 2 / Day 3' plan spans 3). Used when hasDates is false.")
  let dayCount: Int
}

@available(iOS 26.0, *)
@Generable
struct Segmentation {
  @Guide(description: "One day number per input sentence, in the same order: 1 to N for the day that sentence belongs to, or 0 if it is trip-wide and belongs to no single day")
  let dayForSentence: [Int]
}

@available(iOS 26.0, *)
@Generable
struct DayItems {
  @Guide(description: "The items happening on this day, in order; may be empty")
  let items: [DraftItem]
}

@available(iOS 26.0, *)
@Generable
struct DraftItem {
  @Guide(description: "A short name for the item; required and non-empty")
  let name: String
  @Guide(description: "One of: activity, location, stay, meal, note")
  let category: String?
  @Guide(description: "The item's time in 24-hour HH:mm if the plan gives one, converting from 12-hour (8pm becomes 20:00, 9:30am becomes 09:30); omitted only when no time is given. Never guess a time.")
  let time: String?
  @Guide(description: "A street address or place name only — never coordinates — ONLY if the plan names a place for this item; omitted otherwise. Never invent a place or address.")
  let address: String?
  @Guide(description: "Any extra free-text notes, or omitted")
  let notes: String?
  @Guide(description: "A packing or to-do list as checklist entries, or omitted")
  let checklist: [DraftChecklistItem]?
}

@available(iOS 26.0, *)
@Generable
struct DraftChecklistItem {
  @Guide(description: "The checklist entry's label")
  let label: String
  @Guide(description: "Whether the entry is already checked; default false")
  let checked: Bool
}
#endif
