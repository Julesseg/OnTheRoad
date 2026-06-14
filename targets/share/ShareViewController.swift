import UIKit
import UniformTypeIdentifiers

// The thin native Share Extension (ADR-0008, issue #112). It does NO parsing: it
// reads the shared URL and/or text, encodes them into the
// `ontheroad://share?url=…&text=…` deep link, opens the main app, and dismisses.
// All classification, coordinate resolution, trip/day resolution, and persistence
// live in the app's TypeScript (lib/share-capture.ts, app/share.tsx); the
// extension never touches trip storage.
//
// The deep-link encoding here is the Swift side of the contract whose canonical
// spec is `buildShareDeepLink` in lib/share-extension.ts — `percentEncode` mirrors
// JavaScript's `encodeURIComponent` so the bytes this puts on the wire are exactly
// what the app's `parseShareParams` reads back. The activation rule that gates
// when this controller is even instantiated lives in the sibling Info.plist.
class ShareViewController: UIViewController {
  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    Task {
      let payload = await extractPayload()
      if let link = deepLink(url: payload.url, text: payload.text) {
        openHostApp(link)
      }
      finish()
    }
  }

  /// The first shared URL and the first shared text across every attachment. The
  /// extension only activates when at least one of these is present (Info.plist
  /// activation rule), so a capture is never empty.
  private func extractPayload() async -> (url: String?, text: String?) {
    var sharedURL: String?
    var sharedText: String?

    let items = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
    for item in items {
      for attachment in item.attachments ?? [] {
        if sharedURL == nil,
          attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier),
          let loaded = try? await attachment.loadItem(forTypeIdentifier: UTType.url.identifier),
          let url = loaded as? URL
        {
          sharedURL = url.absoluteString
        }
        if sharedText == nil,
          attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
          let loaded = try? await attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier),
          let text = loaded as? String
        {
          sharedText = text
        }
      }
    }

    return (sharedURL, sharedText)
  }

  /// Build `ontheroad://share?url=…&text=…`, mirroring `buildShareDeepLink` in
  /// lib/share-extension.ts: each present value is percent-encoded and empty
  /// values are dropped.
  private func deepLink(url: String?, text: String?) -> URL? {
    var params: [String] = []
    if let url, !url.isEmpty { params.append("url=\(percentEncode(url))") }
    if let text, !text.isEmpty { params.append("text=\(percentEncode(text))") }
    let query = params.isEmpty ? "" : "?" + params.joined(separator: "&")
    return URL(string: "ontheroad://share\(query)")
  }

  /// Percent-encode a query value the way JavaScript's `encodeURIComponent` does:
  /// escape everything except the unreserved set `A–Z a–z 0–9 - _ . ! ~ * ' ( )`,
  /// so query metacharacters like `&`, `?`, and `=` in the value can't split or
  /// truncate the param when the app reads it back.
  private func percentEncode(_ value: String) -> String {
    let unreserved = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()"
    let allowed = CharacterSet(charactersIn: unreserved)
    return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
  }

  /// Open the host app from inside the extension by walking the responder chain to
  /// `UIApplication` — `UIApplication.open` is unavailable to app extensions, so we
  /// perform the `openURL:` selector, the standard share-extension handoff.
  private func openHostApp(_ url: URL) {
    var responder: UIResponder? = self
    let selector = NSSelectorFromString("openURL:")
    while let current = responder {
      if current.responds(to: selector) {
        current.perform(selector, with: url)
        return
      }
      responder = current.next
    }
  }

  private func finish() {
    extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
  }
}
