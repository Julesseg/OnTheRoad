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

- **Architecture (Option B).** The picker renders its *own* full-screen `TripMap`
  instance (`presentation: 'fullScreenModal'`) with the search sheet presented
  over it — mirroring the home map + `/days` split, not the literal home-screen
  map. It is a `fullScreenModal` rather than a plain push so the map is
  edge-to-edge: pushed inside the editor's own modal frame the map would be inset
  (the parent peeking at the top), not truly full-screen. The editor stays
  mounted underneath, so its draft survives and the existing `beginLocationPick`
  handoff is unchanged. (Option A — reusing the live home map by dismissing the
  editor — was rejected: it would require lifting the editor's whole draft into a
  durable store for one continuous camera animation.)
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
- **Toolbars and results live in the sheet, not on the map.** The search sheet
  over the full-screen map carries everything: a top toolbar with **X** (cancel)
  and **Select** (confirm, disabled until something is selected), a native bottom
  `Stack.Toolbar` (`placement="bottom"`) holding a `Stack.SearchBar` slot and a
  separate pin button, and the result-row list in its body. The map underneath is
  static context the camera animates over; the sheet owns all the controls.
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
- **The picker spans two screens** — a full-screen map and the search sheet over
  it — sharing transient picker state through the store, matching the home/`days`
  idiom but adding a second place that reads picker state.
- **Address-only items from old data or JSON import still don't gain pins
  automatically** (no on-load enrichment) — the user re-opens the item and picks
  a point. Same gap ADR-0011 noted; this is now the only route to closing it.
- **Smart Import is being retired**, so the second call site ADR-0011 defined
  (fire-and-forget geocoding after a Smart Import save) is dropped rather than
  reworked.

## Amendment — pin mode is a sheet detent, via a patched detent setter

The first cut shipped pin mode as a *toggle on the pin button* (above) precisely
because `react-native-screens` had "no imperative/controlled detent setter". In
use that read as two unrelated controls — a button that changed the body while the
sheet stayed put — and the sheet felt abrupt. We now make the **sheet detent itself
the mode**:

- The search sheet rests at two detents, `[0.1, 0.5]`. **0.5 is search**; **0.1 is
  pin mode** (the sheet shrinks out of the way so the map is clear to drop a pin).
  The mode follows the detent both ways: dragging between detents toggles it
  (`onSheetDetentChanged`), and the in-sheet buttons move the detent.
- To move the detent *smoothly* from a button we lifted the once-only guard on
  `sheetInitialDetentIndex`. A small **patch to `react-native-screens`**
  (`patches/react-native-screens+4.25.1.patch`, applied via `patch-package`)
  clears `_sheetHasInitialDetentSet` when the prop changes and lets index 0 drive a
  selection, so changing `sheetInitialDetentIndex` re-applies the detent through
  UIKit's `animateChanges:` (animated) instead of snapping. This retires the
  "no controlled detent setter" constraint cited in Context for this screen.
- **Controls.** **Cancel** and **Select** are always in the top bar. Select commits
  the current selection — a chosen result/address *or* a dropped pin — and dismisses
  the picker; it's armed whenever there's something committable. Cancel leaves pin
  mode (back to 0.5) when in pin mode, otherwise aborts the whole pick. Tapping a
  result row only *selects* it (the map flies to its pin for preview); the commit
  stays the explicit Select so the choice is confirmed, never auto-dismissed.
  Search mode (0.5) additionally shows the `Stack.SearchBar` + a **pin button** to
  its right (no selected/active tint).
- The sheet is **titleless and transparent** (`contentStyle` clear +
  `backgroundGlass`/`surfaceGlass` wash) so it reads as liquid glass over the map,
  and the full-screen map page **slides up from the bottom** rather than appearing
  abruptly.
