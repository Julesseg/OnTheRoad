# Share Capture is a system Share Extension that captures in-sheet and hands off via an App Group

## Status

accepted — governs [Share Capture](../../CONTEXT.md#share-capture); complements
[ADR-0007](0007-share-capture-network-coordinate-resolution.md), which covers
only coordinate resolution within this feature.

Supersedes the original "thin shim opens the app via a deep link" decision, which
on-device testing (iOS 26.5) proved impossible — see Context.

## Context

Share Capture must appear in the iOS **system share sheet** (Google Maps, Apple
Maps, Safari), which is only possible with a native **Share Extension** target —
a separate process that cannot see the main app's document directory.

The original design was a **thin native shim**: capture the URL/text, encode an
`ontheroad://share?…` deep link, **open the host app**, and dismiss. This does not
work on modern iOS: a Share extension cannot open its containing app. The
responder-chain `openURL:` hack was removed for app extensions in iOS 18+, and
`NSExtensionContext.open` is restricted to Today/iMessage extensions (returns
`false` for Share extensions). There is no API to open the host app from a Share
extension. Confirmed on device and simulator: the extension activated and captured
correctly, but the hand-off never brought the app forward.

The remaining options were the standard ones every share-capable app uses: render
the capture UI **inside the extension** (Things, Bear, Pinterest) and hand data
off through a **shared App Group container**, never opening the app.

## Decision

The extension **presents its own compose sheet** — a custom SwiftUI UI (a
principal `UIViewController` hosting it, not `SLComposeServiceViewController`) themed
to match the app's Ember palette, with a **Trip** menu, a **graphical Day** picker
bounded to the trip's span, an optional **time** picker, and a note field. It hands
the capture off through an **App Group** (`group.com.anonymous.on-the-road`) and
still does **no parsing**:

- The app mirrors a lightweight `tripsIndex` (`{id, title, dates[]}` per trip) into
  the App Group on every state change, so the extension's pickers are current.
- On Add, the extension appends a `PendingCapture` (`{url?, text?, title?, note?,
  tripId, date, time?, capturedAt}`) to a `pendingCaptures` queue in the App Group
  `UserDefaults` suite, then dismisses. No editor, no app launch.
- The app **drains the queue in the background** on launch and on every return to
  the foreground (`lib/use-share-intake.ts`), running the existing pipeline —
  `classifyShare` → `resolveShareCoords` → `upsertItem` — with no editor shown,
  so several items shared before the app is opened all land.

The wire contract (App Group keys + JSON shapes) is specified once in
`lib/share-bridge.ts` and mirrored by `targets/share/ShareViewController.swift`; a
round-trip test pins the two sides together. The `ontheroad://share` deep-link
route and the [Share editor](../../CONTEXT.md#share-editor) remain for any external
caller, but are no longer how the extension hands off.

## Consequences

- Classification/geocoding/persistence stay in one place (TS); the extension only
  collects input and queues it. **Trip files stay single-process** — the extension
  never writes them, so the atomic-write guarantee in `lib/storage.ts` is untouched.
  Only the `tripsIndex` (app→extension) and `pendingCaptures` (extension→app) cross
  the App Group boundary.
- **Capture is deferred, not instant.** Tapping the action saves the item; it
  appears the next time the app is opened, with no editor. This is inherent to the
  platform constraint — a Share extension cannot route the user into the app.
- The extension picks **trip + day** in-sheet; day defaults via the same
  `defaultCaptureDate` rule as the editor. Coordinate resolution runs in the app on
  ingest, so a network failure degrades to an address-only Place (as in the editor).
- New surfaces to maintain: the App Group entitlement on both targets (auto-synced
  by `@bacons/apple-targets`), the `share-bridge` contract, and the native compose
  UI. Recorded so the in-sheet choice isn't mistaken for scope creep — it is the
  only design that works on iOS 18+.
- Zero-trips is a current gap: with no trips to pick, the extension cannot file a
  capture. Acceptable for v1 (the app owns trip creation); revisit if needed.
