import ExpoModulesCore

#if canImport(FoundationModels)
import FoundationModels
#endif

// On-device Smart Import generation (issue #97, ADR-0006). Runs Apple's
// Foundation Models with GUIDED GENERATION constrained to a draft trip schema —
// no UUIDs, timestamps, schemaVersion, or coordinates, since the model never
// invents those. The app (lib/smart-import.ts) assigns ids + timestamps and
// validates through the same TripSchema gate as JSON Import. Reads nothing from
// the network: inference is entirely local.
//
// Registered under the name "SmartImport"; the JS wrapper loads it with
// requireOptionalNativeModule and only calls it once the availability probe
// (SmartImportAvailability) reports the model is available. The returned string
// is JSON in exactly the shape lib/smart-import.ts's DraftTripSchema expects.
public class SmartImportModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SmartImport")

    // Async: on-device inference is slow. Throws on an unsupported OS, an
    // unavailable model, or a document the ~4k-token context can't hold — every
    // one surfaces to JS as a rejected promise so the flow fails loud and saves
    // nothing (CONTEXT.md#smart-import).
    AsyncFunction("generate") { (text: String) async throws -> String in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        return try await generateDraftJSON(from: text)
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
@available(iOS 26.0, *)
private func generateDraftJSON(from document: String) async throws -> String {
  let instructions = """
  You convert a free-text trip plan into a structured draft for the "On the Road" \
  travel app. Read the trip description and produce the trip's title, its inclusive \
  start and end calendar dates, and one day per calendar date from start through end \
  (no gaps), each holding the items that belong on it.

  Rules:
  - Dates are "YYYY-MM-DD". Items' time is 24-hour "HH:mm" or omitted.
  - category is one of: activity, location, stay, meal, note. Use stay for lodging, \
  meal for food, location for a place to see, activity for things to do, note for \
  reminders. Default to activity when unsure.
  - Capture places as address TEXT ONLY — never latitude/longitude.
  - Never drop content. Anything with no clear day (a packing list, a budget, \
  "book the ferry") goes on the most plausible day as a note item; a booking \
  reminder on the day it concerns, trip-wide content on day one. Packing and \
  to-do lists become a checklist.
  """

  let session = LanguageModelSession(instructions: instructions)
  let draft = try await session.respond(to: document, generating: DraftTrip.self).content

  // Serialize to the exact JSON shape lib/smart-import.ts's DraftTripSchema
  // expects — notably address is nested under `location`, not a flat field.
  let payload: [String: Any] = [
    "title": draft.title,
    "startDate": draft.startDate,
    "endDate": draft.endDate,
    "days": draft.days.map { day -> [String: Any] in
      [
        "date": day.date,
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
    },
  ]

  let data = try JSONSerialization.data(withJSONObject: payload)
  return String(decoding: data, as: UTF8.self)
}

// The guided-generation schema. @Generable constrains decoding to this shape so
// the model can only emit a valid draft; @Guide steers each field. Mirrors
// DraftTripSchema in lib/smart-import.ts (address is flat here for cleaner
// generation, then nested under `location` when serialized above).
@available(iOS 26.0, *)
@Generable
struct DraftTrip {
  @Guide(description: "A short title for the trip")
  let title: String
  @Guide(description: "The first calendar date of the trip, formatted YYYY-MM-DD")
  let startDate: String
  @Guide(description: "The last calendar date of the trip, inclusive, formatted YYYY-MM-DD")
  let endDate: String
  @Guide(description: "One entry per calendar date from startDate through endDate inclusive, in order")
  let days: [DraftDay]
}

@available(iOS 26.0, *)
@Generable
struct DraftDay {
  @Guide(description: "This day's calendar date, formatted YYYY-MM-DD")
  let date: String
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
  @Guide(description: "A specific time in 24-hour HH:mm, or omitted")
  let time: String?
  @Guide(description: "A street address or place name only — never coordinates; omitted if there is no place")
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
