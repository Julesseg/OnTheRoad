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

    // Pass 2 — one day's items: `{items:[…]}` JSON. `dayNumber`/`totalDays` (both
    // 1-based) let the model match how the plan labels the day; `includeUnscheduled`
    // (day one only) folds in trip-wide content that has no specific day.
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

enum SmartImportError: Error {
  case unsupported
}

#if canImport(FoundationModels)
// Pass 1: just the trip header. Tiny output, so it never strains the window.
@available(iOS 26.0, *)
private func generateOutlineJSON(from document: String) async throws -> String {
  let instructions = """
  You read a free-text trip plan for a travel app and return only its header: a \
  short trip title and the inclusive start and end calendar dates as "YYYY-MM-DD". \
  If the plan covers a single day, start and end are that same date.
  """

  let session = LanguageModelSession(instructions: instructions)
  let outline = try await session.respond(to: document, generating: TripOutline.self).content

  let payload: [String: Any] = [
    "title": outline.title,
    "startDate": outline.startDate,
    "endDate": outline.endDate,
  ]
  let data = try JSONSerialization.data(withJSONObject: payload)
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
  You extract the items happening on ONE day of a trip from a free-text plan.

  Capture EVERY item the plan lists for this day — each activity, meal, place, \
  check-in, and reminder it mentions, even short ones. Do not skip or merge items. \
  Then, for each item, fill in detail ONLY from what the text actually says: never \
  invent or guess a time, place, name, or activity that is not written. Capturing a \
  stated item with a missing field is right; adding a plausible-sounding field is wrong.

  Which day: this is day \(dayNumber) of \(totalDays), the calendar date \(date). The \
  plan may label this day as "Day \(dayNumber)", a weekday, or a date (for example a \
  month and day) — treat any of those that point to this day as the same day. Return \
  the items under that heading. Only return an empty list if the plan truly lists \
  nothing for this day.

  Rules:
  - time: whenever the plan gives a time for an item, include it — and convert it to \
  24-hour "HH:mm". A 12-hour time becomes: 9:30am → "09:30", 8pm → "20:00", 11am → \
  "11:00", 6pm → "18:00", noon → "12:00", midnight → "00:00". Omit time only when the \
  plan gives none for that item; never guess or estimate one.
  - category is one of: activity, location, stay, meal, note (stay for lodging, meal \
  for food, location for a place to see, activity for things to do, note for \
  reminders); default to activity when unsure.
  - location/address: include only a place or address the plan actually names, as \
  address TEXT ONLY — never latitude/longitude. Never invent or complete an address. \
  Omit it when the plan names no place.
  - Packing and to-do lists become a checklist only when there is more than one item.
  """
  if includeUnscheduled {
    instructions += """

    - Also include any trip-wide content with no specific day (a packing list, a \
    budget, "book the ferry") here, as note items or checklists.
    """
  }

  let session = LanguageModelSession(instructions: instructions)
  let prompt = "Extract the items for day \(dayNumber) of \(totalDays) (\(date)).\n\nTrip plan:\n\(document)"
  let options = GenerationOptions(maximumResponseTokens: 2000)
  let day = try await session.respond(to: prompt, generating: DayItems.self, options: options).content

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
  @Guide(description: "The first calendar date of the trip, formatted YYYY-MM-DD")
  let startDate: String
  @Guide(description: "The last calendar date of the trip, inclusive, formatted YYYY-MM-DD")
  let endDate: String
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
