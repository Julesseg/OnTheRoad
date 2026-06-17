# The Location Picker is map-centered; address-only is a deliberate last resort

## Status

accepted — supersedes [ADR-0011](0011-address-to-coordinates-resolution.md) in
full. Governs the [Location Picker](../../CONTEXT.md#location-picker) and how an
[Item](../../CONTEXT.md#item) acquires its `location`.

## Context

The picker has been redesigned twice already (a unified poly-input field, then
its own sheet with an inline square map). Both kept the map *secondary*: a typed
address could be confirmed as an address-only `{ address }` location as a silent
peer of the Photon search results, so coordinates were easy to skip and
[Items](../../CONTEXT.md#item) without `lat`/`lng` never render as
[Pins](../../CONTEXT.md#pin). [ADR-0011](0011-address-to-coordinates-resolution.md)
patched that with an *invisible* geocode-on-confirm — but a silent resolution
hides its own failure mode and auto-picks a possibly-wrong candidate the user
never sees.

We want coordinates to be the overwhelmingly common outcome, reached by the user
*seeing* candidate points on a map and choosing one, with address-only demoted to
a rare, deliberate fallback for when there is genuinely no point to drop.

Two facts about the environment shaped the mechanics:

- The item editor is presented `modal`, so it fully covers the home screen's
  map, and its draft is local component state that would be lost if the editor
  unmounted.
- `react-native-screens` (4.25.1) has **no imperative/controlled detent
  setter** — `sheetInitialDetentIndex` applies once, on first layout — but
  `sheetAllowedDetents` *is* updatable at runtime and `onSheetDetentChanged`
  reports drags. (This is the same constraint that forces the `/days` sheet to
  re-present to reset its detent.)

## Decision

The picker becomes **map-centered**, mirroring the home screen's split of a
full-screen map with a sheet over it.

- **Architecture (Option B).** The picker is a *single* full-screen page
  (`presentation: 'fullScreenModal'`) that renders its *own* full-screen
  `TripMap` instance — not the literal home-screen map. It is a `fullScreenModal`
  rather than a plain push so the map is edge-to-edge: pushed inside the editor's
  own modal frame the map would be inset (the parent peeking at the top), not
  truly full-screen. The editor stays mounted underneath, so its draft survives
  and the existing `beginLocationPick` handoff is unchanged. (Option A — reusing
  the live home map by dismissing the editor — was rejected: it would require
  lifting the editor's whole draft into a durable store for one continuous camera
  animation.)
- **Two map layers.** The trip's existing [Pins](../../CONTEXT.md#pin) and route
  are always rendered **greyed** as context; search candidates are accent
  **[result pins](../../CONTEXT.md#result-pin)** on top.
- **Selection drives the camera, and is sticky.** Live search yields selectable
  result rows. Selecting a result zooms the camera to its result pin; the first
  result auto-selects on arrival; switching rows moves the camera pin-to-pin.
  There is **no deselect** — the only way back to "nothing selected" is the X
  cancel. Confirming ("Select") returns the selected result's coordinates (plus
  its name as the `address` label) to the editor.
- **Pasted coordinates / maps URL** become a single synthesized result pin
  (the URL resolved first, with a transient "Resolving…" row), auto-selected.
- **Plain address is the last resort.** A permanent "Use '<text>' as a plain
  address" row sits at the bottom of the list; selecting it is the lone
  zoom-*out* (it frames the greyed trip) and commits address-only
  `{ address }`. This is the only path that produces an address-only location.
- **Search field and pin button live in a bottom toolbar.** The full-screen map
  carries a native bottom `Stack.Toolbar` (`placement="bottom"`) holding a
  `Stack.SearchBar` slot and a separate pin button. Typing surfaces the result
  rows in a list that floats over the map above the toolbar; the page's top
  toolbar carries **X** (cancel) and **Select** (confirm, disabled until
  something is selected). There is no sheet and no detents — the search field is
  always in reach and the map is always full-screen behind it.
- **Pin-selection mode** lets the user drop a pin anywhere on the map for
  coordinates with no address, for when search finds nothing usable. It is a
  **toggle on the pin button** (not a sheet detent): turning it on hides the
  result list and arms map taps to drop/move a single pin; turning it off
  restores the prior search query, results, and selection verbatim. The pin
  button's selected state shows which mode is active.
- **Opens blank every time.** The picker no longer reads the item's current
  location; cancelling leaves the existing location untouched.

## Consequences

- **Coordinates are the default; address-only is rare and intentional.** It now
  requires deliberately choosing the bottom row (or having no search hit at
  all), so it reads as a genuine last resort rather than an easy default.
- **Resolution is visible and user-driven.** There is no silent geocode-on-
  confirm and no background enrichment pass; a wrong auto-pick is seen on the map
  and corrected before commit. ADR-0011's silent two-call-site scheme is retired.
- **The picker is one full-screen page** — a map with a bottom-toolbar search
  field and a floating result list — that owns its transient picker state in one
  place rather than threading it through a separate sheet screen.
- **Address-only items from old data or JSON import still don't gain pins
  automatically** (no on-load enrichment) — the user re-opens the item and picks
  a point. Same gap ADR-0011 noted; this is now the only route to closing it.
- **Smart Import is being retired**, so the second call site ADR-0011 defined
  (fire-and-forget geocoding after a Smart Import save) is dropped rather than
  reworked.
