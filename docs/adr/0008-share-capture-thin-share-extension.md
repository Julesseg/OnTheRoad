# Share Capture is a system Share Extension that hands its payload to the main app

## Status

accepted — governs [Share Capture](../../CONTEXT.md#share-capture); complements
[ADR-0007](0007-share-capture-network-coordinate-resolution.md), which covers
only coordinate resolution within this feature.

## Context

Share Capture must appear in the iOS **system share sheet** (Google Maps, Apple
Maps, Safari), which is only possible with a native **Share Extension** target —
a separate process that cannot see the main app's document directory. Two shapes
were genuinely on the table:

- A **thin native extension** that captures the shared URL/text and hands it to
  the main app, which does all the work.
- An **RN-in-extension** (e.g. `expo-share-extension`) that renders its own
  mini-editor, parses, geocodes, and writes Items straight into App-Group-shared
  trip storage — never leaving the sheet.

## Decision

The extension is a **thin native shim**. It captures the shared URL and/or text,
encodes it into an `ontheroad://share?…` deep link, opens the main app, and
dismisses. All classification, network coordinate resolution, trip/day
resolution, the [Share editor](../../CONTEXT.md#share-editor), and persistence
live in the main app's TypeScript, reusing the existing item editor, Photon,
maps, and store code. There is **no App-Group trip storage**; the extension
never touches trip files.

## Consequences

- One implementation of parsing/geocoding/storage (TS), not a duplicated
  Swift/RN copy running in a second process. The extension stays small and
  rarely changes.
- Trip files stay single-process — no App Group, and no cross-process writes
  racing the atomic-write guarantee in `lib/storage.ts`.
- The cost is a visible hop: the share sheet dismisses and the app comes to the
  foreground (cold-starting if it was closed) before the user confirms.
  Accepted, because it lands the user on a screen where they can pick the
  destination day — which the in-sheet model can't do as naturally. iOS does not
  return to the source app afterwards.
- Reversing to an in-sheet RN extension later means adding an App Group, shared
  trip storage, and a second entry point into the store — meaningful work,
  recorded so the thin-shim choice isn't mistaken for an oversight.
