import SwiftUI
import UIKit
import UniformTypeIdentifiers

// The iOS Share Extension UI (ADR-0008). A Share extension cannot open its host app
// on iOS 18+ (the responder-chain `openURL:` hack was removed and
// `NSExtensionContext.open` is Today/iMessage-only), so instead of handing off a
// deep link this presents its own compose sheet — pick a Trip, a Day, optionally a
// time, add a note — and queues the capture into a shared App Group container. The
// app drains that queue in the background on next foreground (lib/use-share-intake.ts).
// It still does NO parsing: classification, coordinate resolution, and persistence
// stay in the app's TS.
//
// Unlike the stock `SLComposeServiceViewController`, this is a custom principal
// UIViewController hosting a SwiftUI compose sheet so the UI matches the app: the
// Ember palette (constants/theme.ts), a graphical day picker bounded to the trip's
// span, and an optional time picker.
//
// The App Group keys and the JSON shapes here are the Swift side of the contract
// whose canonical spec is lib/share-bridge.ts — `tripsIndex` is written by the app
// and read here; `pendingCaptures` is appended here and read by the app.
class ShareViewController: UIViewController {
  private let appGroup = "group.com.anonymous.on-the-road"
  private let tripsIndexKey = "tripsIndex"
  private let pendingCapturesKey = "pendingCaptures"

  private var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }
  private var model: ShareModel!

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear

    model = ShareModel(trips: loadTrips())
    let root = ShareComposeView(
      model: model,
      onSubmit: { [weak self] in self?.submit() },
      onCancel: { [weak self] in self?.cancel() }
    )
    let host = UIHostingController(rootView: root)
    host.view.backgroundColor = .clear
    addChild(host)
    view.addSubview(host.view)
    host.view.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      host.view.topAnchor.constraint(equalTo: view.topAnchor),
      host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
    ])
    host.didMove(toParent: self)

    Task {
      let shared = await extractShared()
      model.applyShared(url: shared.url, text: shared.text)
    }
  }

  // MARK: - Completion

  private func submit() {
    appendCapture(model.buildCapture())
    extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
  }

  private func cancel() {
    extensionContext?.cancelRequest(withError: NSError(domain: "ShareCancelled", code: 0))
  }

  // MARK: - App Group I/O

  private func loadTrips() -> [TripIndexEntry] {
    guard
      let json = defaults?.string(forKey: tripsIndexKey),
      let data = json.data(using: .utf8),
      let decoded = try? JSONDecoder().decode([TripIndexEntry].self, from: data)
    else { return [] }
    return decoded
  }

  private func appendCapture(_ capture: [String: Any]?) {
    guard let capture, let defaults else { return }
    var queue = existingQueue()
    queue.append(capture)
    if
      let data = try? JSONSerialization.data(withJSONObject: queue),
      let json = String(data: data, encoding: .utf8)
    {
      defaults.set(json, forKey: pendingCapturesKey)
    }
  }

  private func existingQueue() -> [[String: Any]] {
    guard
      let json = defaults?.string(forKey: pendingCapturesKey),
      let data = json.data(using: .utf8),
      let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else { return [] }
    return array
  }

  /// The first shared URL and the first shared plain text across the attachments.
  /// The URL is what the app classifies from; the text rides into `text` (a Maps
  /// share carries the place name there), while the user's free-text note is
  /// captured separately in the compose field.
  private func extractShared() async -> (url: String?, text: String?) {
    var url: String?
    var text: String?
    let items = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
    for item in items {
      for attachment in item.attachments ?? [] {
        if
          url == nil,
          attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier),
          let loaded = try? await attachment.loadItem(forTypeIdentifier: UTType.url.identifier),
          let value = loaded as? URL
        {
          url = value.absoluteString
        }
        if
          text == nil,
          attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
          let loaded = try? await attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier),
          let value = loaded as? String
        {
          text = value.trimmingCharacters(in: .whitespacesAndNewlines)
        }
      }
    }
    return (url, text?.isEmpty == true ? nil : text)
  }
}

/// One trip as the compose sheet's Trip + Day pickers need it — the Swift mirror of
/// `TripIndexEntry` in lib/share-bridge.ts.
struct TripIndexEntry: Decodable, Identifiable {
  let id: String
  let title: String
  /// Inclusive YYYY-MM-DD span — the bounds the day picker is clamped to.
  let dates: [String]
}

// MARK: - View model

@MainActor
final class ShareModel: ObservableObject {
  let trips: [TripIndexEntry]

  @Published var selectedTripIndex = 0
  @Published var selectedDate = Date()
  @Published var includeTime = false
  @Published var time = Date()
  @Published var note = ""
  @Published var sharedURL: String?
  @Published var sharedText: String?
  @Published var title = ""

  init(trips: [TripIndexEntry]) {
    self.trips = trips
    if let first = trips.first {
      selectedDate = Self.dayFormatter.date(from: defaultDate(for: first)) ?? Date()
    }
  }

  var hasTrips: Bool { !trips.isEmpty }
  var selectedTrip: TripIndexEntry? { trips.indices.contains(selectedTripIndex) ? trips[selectedTripIndex] : nil }

  /// The closed day range the graphical picker is bounded to: the selected trip's
  /// first…last day. Every date inside is a valid trip day (the span is contiguous).
  var dayRange: ClosedRange<Date> {
    guard
      let trip = selectedTrip,
      let firstStr = trip.dates.first, let lastStr = trip.dates.last,
      let first = Self.dayFormatter.date(from: firstStr),
      let last = Self.dayFormatter.date(from: lastStr),
      first <= last
    else { let now = Date(); return now ... now }
    return first ... last
  }

  func selectTrip(_ index: Int) {
    guard trips.indices.contains(index) else { return }
    selectedTripIndex = index
    let range = dayRange
    if selectedDate < range.lowerBound || selectedDate > range.upperBound {
      selectedDate = Self.dayFormatter.date(from: defaultDate(for: trips[index])) ?? range.lowerBound
    }
  }

  /// Record the extracted share and prefill the editable title from it (the shared
  /// text's first line, else the URL host), unless the user has already typed one.
  func applyShared(url: String?, text: String?) {
    sharedURL = url
    sharedText = text
    if title.isEmpty { title = Self.initialTitle(text: text, url: url) }
  }

  static func initialTitle(text: String?, url: String?) -> String {
    if let firstLine = text?.split(separator: "\n").first, !firstLine.isEmpty {
      return String(firstLine)
    }
    return url.flatMap { hostWithoutWWW($0) } ?? ""
  }

  static func hostWithoutWWW(_ urlString: String) -> String? {
    guard let host = URL(string: urlString)?.host else { return nil }
    return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
  }

  /// Mirrors `defaultCaptureDate` (lib/share-capture.ts): today if it falls in the
  /// trip, otherwise the trip's first day.
  private func defaultDate(for trip: TripIndexEntry) -> String {
    let today = Self.dayFormatter.string(from: Date())
    return trip.dates.contains(today) ? today : (trip.dates.first ?? today)
  }

  /// The capture dict matching the `PendingCapture` wire shape in lib/share-bridge.ts.
  func buildCapture() -> [String: Any]? {
    guard let trip = selectedTrip else { return nil }
    var capture: [String: Any] = [
      "tripId": trip.id,
      "date": Self.dayFormatter.string(from: selectedDate),
      "capturedAt": Self.iso8601Formatter.string(from: Date()),
    ]
    if includeTime { capture["time"] = Self.timeFormatter.string(from: time) }
    if let sharedURL { capture["url"] = sharedURL }
    if let sharedText, !sharedText.isEmpty { capture["text"] = sharedText }
    let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmedTitle.isEmpty { capture["title"] = trimmedTitle }
    let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmedNote.isEmpty { capture["note"] = trimmedNote }
    return capture
  }

  // MARK: Formatters

  static let dayFormatter: DateFormatter = {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f
  }()

  static let timeFormatter: DateFormatter = {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "HH:mm"
    return f
  }()

  static let iso8601Formatter = ISO8601DateFormatter()
}

// MARK: - SwiftUI

/// The Ember palette (constants/theme.ts) resolved for the active color scheme, so
/// the sheet reads as part of the app rather than a stock share dialog.
private struct Theme {
  let background, surface, text, textSubtle, accent, onAccent, separator: Color

  static func resolve(_ scheme: ColorScheme) -> Theme {
    scheme == .dark
      ? Theme(
          background: Color(hex: "1c1b19"), surface: Color(hex: "242320"),
          text: Color(hex: "d8d0c0"), textSubtle: Color(hex: "938976"),
          accent: Color(hex: "e08060"), onAccent: Color(hex: "1c1b19"),
          separator: Color(hex: "3d3a34"))
      : Theme(
          background: Color(hex: "e6dac4"), surface: Color(hex: "ebe4d6"),
          text: Color(hex: "282418"), textSubtle: Color(hex: "81765f"),
          accent: Color(hex: "b84c30"), onAccent: Color(hex: "ffffff"),
          separator: Color(hex: "ccbea4"))
  }
}

private extension Color {
  init(hex: String) {
    let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    var int: UInt64 = 0
    Scanner(string: h).scanHexInt64(&int)
    self.init(
      red: Double((int >> 16) & 0xFF) / 255,
      green: Double((int >> 8) & 0xFF) / 255,
      blue: Double(int & 0xFF) / 255)
  }
}

struct ShareComposeView: View {
  @ObservedObject var model: ShareModel
  let onSubmit: () -> Void
  let onCancel: () -> Void

  @Environment(\.colorScheme) private var scheme
  @FocusState private var focusedField: Field?

  private enum Field { case title, note }

  private var theme: Theme { Theme.resolve(scheme) }

  var body: some View {
    VStack(spacing: 0) {
      header
      Divider().overlay(theme.separator)
      if model.hasTrips {
        composer
      } else {
        emptyState
      }
    }
    .background(theme.background.ignoresSafeArea())
    .tint(theme.accent)
  }

  private var header: some View {
    HStack {
      Button("Cancel", action: onCancel)
        .buttonStyle(.glass)
        .tint(theme.accent)
      Spacer()
      Text("Add to On the Road")
        .font(.headline)
        .foregroundStyle(theme.text)
      Spacer()
      Button("Add", action: onSubmit)
        .fontWeight(.semibold)
        .buttonStyle(.glassProminent)
        .tint(theme.accent)
        .disabled(!model.hasTrips)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
  }

  private var composer: some View {
    ScrollView {
      VStack(spacing: 16) {
        preview
        if model.hasTrips { tripCard }
        dayCard
        timeCard
        noteCard
      }
      .padding(16)
    }
    .scrollDismissesKeyboard(.interactively)
  }

  // The editable item title (prefilled from the shared content) over the source
  // host, so the user can see what they captured and rename it before filing.
  private var preview: some View {
    card {
      HStack(spacing: 12) {
        Image(systemName: previewSymbol)
          .font(.title2)
          .foregroundStyle(theme.accent)
          .frame(width: 32)
        VStack(alignment: .leading, spacing: 2) {
          TextField("Title", text: $model.title, axis: .vertical)
            .font(.body.weight(.medium))
            .foregroundStyle(theme.text)
            .lineLimit(1 ... 2)
            .focused($focusedField, equals: .title)
          if let subtitle = previewSubtitle {
            Text(subtitle)
              .font(.footnote)
              .foregroundStyle(theme.textSubtle)
              .lineLimit(1)
          }
        }
        Spacer(minLength: 0)
      }
    }
  }

  private var tripCard: some View {
    card {
      HStack {
        Text("Trip").foregroundStyle(theme.textSubtle)
        Spacer()
        Menu {
          ForEach(Array(model.trips.enumerated()), id: \.element.id) { index, trip in
            Button(trip.title) { model.selectTrip(index) }
          }
        } label: {
          HStack(spacing: 6) {
            Text(model.selectedTrip?.title ?? "")
              .foregroundStyle(theme.text)
            Image(systemName: "chevron.up.chevron.down")
              .font(.footnote)
              .foregroundStyle(theme.accent)
          }
        }
      }
    }
  }

  private var dayCard: some View {
    card {
      VStack(alignment: .leading, spacing: 8) {
        Text("Day").foregroundStyle(theme.textSubtle)
        DatePicker(
          "Day",
          selection: $model.selectedDate,
          in: model.dayRange,
          displayedComponents: .date
        )
        .datePickerStyle(.graphical)
        .labelsHidden()
        .tint(theme.accent)
        // Rebuild the picker from scratch when the trip changes. Mutating a live
        // graphical DatePicker's `in:` range and `selection` in the same update
        // traps when the old selection falls outside the new range; a fresh
        // identity initialises both together and consistently.
        .id(model.selectedTripIndex)
      }
    }
  }

  private var timeCard: some View {
    card {
      VStack(spacing: 4) {
        Toggle(isOn: $model.includeTime) {
          Text("Set a time").foregroundStyle(theme.text)
        }
        .tint(theme.accent)
        if model.includeTime {
          DatePicker("Time", selection: $model.time, displayedComponents: .hourAndMinute)
            .foregroundStyle(theme.text)
            .tint(theme.accent)
            .padding(.top, 8)
        }
      }
    }
  }

  private var noteCard: some View {
    card {
      VStack(alignment: .leading, spacing: 8) {
        Text("Note").foregroundStyle(theme.textSubtle)
        TextField("Add a note", text: $model.note, axis: .vertical)
          .lineLimit(1 ... 4)
          .foregroundStyle(theme.text)
          .focused($focusedField, equals: .note)
      }
    }
  }

  private var emptyState: some View {
    VStack(spacing: 12) {
      Spacer()
      Image(systemName: "map")
        .font(.largeTitle)
        .foregroundStyle(theme.textSubtle)
      Text("No trips yet")
        .font(.headline)
        .foregroundStyle(theme.text)
      Text("Create a trip in On the Road, then share this here.")
        .font(.subheadline)
        .multilineTextAlignment(.center)
        .foregroundStyle(theme.textSubtle)
      Spacer()
    }
    .padding(32)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  // MARK: Helpers

  private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
    content()
      .padding(14)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(theme.surface)
      .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
  }

  private var isMapsLink: Bool {
    guard let host = model.sharedURL.flatMap({ URL(string: $0)?.host }) else { return false }
    let h = host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    return h == "maps.apple.com" || h == "maps.app.goo.gl" || h.hasPrefix("maps.google") || h.contains("google.")
  }

  private var previewSymbol: String {
    if model.sharedURL == nil { return "note.text" }
    return isMapsLink ? "mappin.circle.fill" : "link"
  }

  private var previewSubtitle: String? {
    model.sharedURL.flatMap { ShareModel.hostWithoutWWW($0) }
  }
}
