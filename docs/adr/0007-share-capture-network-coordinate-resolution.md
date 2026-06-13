# Share Capture resolves shared map links over the network to get coordinates

## Status

accepted — governs [Share Capture](../../CONTEXT.md#share-capture); extends, and
deliberately tensions, the local-first stance in
[Local-first storage](../../CONTEXT.md#local-first-storage).

## Context

A Google Maps share is usually multi-line text (place name + address) plus an
opaque short link `maps.app.goo.gl/…` that carries **no coordinates in the URL
itself**. Coordinates are what put a pin on the trip-route map
([`tripRouteCoords`](../../lib/trip-route.ts) only plots items with `lat`/`lng`),
so getting them from the everyday share means following the short link's redirect
to its full URL and parsing `@lat,lng`. The app is otherwise local-first and
today only ever calls `photon.komoot.io` for geocoding — Google is a new host.

## Decision

Share Capture resolves coordinates in layers:

1. Parse coordinates straight from the URL when present (full Google/Apple Maps
   URLs embed `@lat,lng` / `?q=lat,lng` / `!3d…!4d…`) — no network.
2. For a short link, follow the redirect over the network and parse the resolved
   URL.
3. If that fails, geocode the shared name/address through the existing Photon
   service.

When every layer fails (offline, unparseable), the Item is still created
**address-only, with no pin** — the capture is never dropped. The user always
confirms the draft [Capture](../../CONTEXT.md#capture) in the
[Share editor](../../CONTEXT.md#share-editor) before it is saved.

## Consequences

- Introduces a new outbound host (Google) at share time, beyond the existing
  Photon call. The disclosure is narrow — the link was just handed to us by
  Google — but the pin now depends on connectivity at the moment of capture.
- Coordinate quality is tiered and best-effort: exact when the URL or redirect
  yields `@lat,lng`, approximate when it falls back to Photon geocoding, absent
  when offline. Downstream already tolerates pin-less items.
- This is the opposite stance to [ADR-0006](0006-smart-import-on-device-only.md),
  where Smart Import deliberately captures locations as address text only to stay
  off the network. The difference is intent: a share is an explicit, single,
  user-initiated act where a real pin is the whole point, so the network cost is
  worth it; Smart Import processes a whole document at once and keeps the
  local-first guarantee instead.
- Reversing to a no-Google stance means losing reliable pins from the common
  Google Maps share (only full URLs with embedded coords, or Photon-geocoded
  address text, would pin) — recorded so it isn't quietly drifted into.
