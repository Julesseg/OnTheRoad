# Hybrid native header for the Displayed Trip sheet

## Status

accepted — builds on [ADR-0001](0001-single-page-displayed-trip.md) (the `/days` permanent `formSheet` over a SwiftUI `List`).

## Context

The Displayed Trip header was a big centred title flanked by two large round
controls (a blue countdown badge and a round glass Trips button). The rework
(issue #44) wants a **standard navigation row** of Liquid Glass buttons with a
**leading large title underneath** that, on scroll, **collapses into a compact
inline title between the buttons** behind a blur that separates header from
content.

The obvious native route is expo-router's composition header — `Stack.Toolbar`
(native Liquid Glass bar items, `Menu`, grouped/separate glass backgrounds),
`Stack.Header blurEffect` (native nav-bar blur), and `Stack.Title large`
(native collapsing large title). The first two work regardless. The third does
not: react-native-screens drives the large-title collapse from a **React Native
scroll view's** content offset, but the itinerary is an **expo-ui SwiftUI
`List`** inside a `Host` — a native view RNScreens can't observe — so
`Stack.Title large` would render a large title that never collapses.

The app targets **iOS 26**, so native glass bar items and
`useScrollGeometryChange` (iOS 18+) are both guaranteed; there are no fallback
paths to design.

## Decision

Use a **hybrid** header on `/days`:

- **Native bar.** `Stack.Toolbar placement="left"` for a neutral back-arrow
  (shown only while the Displayed Trip differs from the resolved default);
  `Stack.Toolbar placement="right"` for the star ("make favorite", gated by
  `canFavorite`, in its own glass capsule via `separateBackground`) plus a
  grouped Trips button + `⋯` overflow `Menu` (Export / Delete). `Stack.Header
  blurEffect` provides the native blur band.
- **Large title is List content, not a native title.** The trip title
  (leading-aligned, large) with a `dates · countdown-pill` line beneath it is
  rendered as the **first row of the SwiftUI `List`**, so it scrolls away
  naturally under the bar — deliberately *not* `Stack.Title large`.
- **Inline title is a custom view toggled by scroll.** `Stack.Title asChild`
  renders a compact custom title (title + a smaller `dates · pill` line) that is
  cross-faded in as the large-title row scrolls under the bar, driven by
  `useScrollGeometryChange` (UI-thread worklet, iOS 18+).

## Considered options

- **Fully native (`Stack.Title large`).** Rejected: cannot track the SwiftUI
  `List`, so the title would never collapse.
- **Migrate the itinerary to a React Native `FlatList`** to unlock the automatic
  native collapse. Rejected: would discard the SwiftUI `List`'s native swipe
  actions, context menus, and `insetGrouped` look (a large rewrite of
  `ItineraryPanel`) for an effect the hybrid achieves while keeping them.
- **Pure custom overlay** (no native bar; `expo-glass-effect` capsules, worklet
  translate + cross-fade). Rejected: re-draws glass the app could get natively
  from real bar items.

## Consequences

- The native header is enabled for the `/days` `formSheet` (placement
  left/right implies `headerShown`), replacing the in-sheet RN header overlay.
- The countdown badge stops being a big round control: it becomes a small pill
  on the `dates · pill` line, present in both the expanded and (more compact)
  collapsed states; it is not shown standalone.
- The empty state keeps a single Trips button (the gateway to
  Settings/Archived/Import) and a non-collapsing "On the Road" large title.
- A future reader must not "simplify" this to `Stack.Title large` — that breaks
  the collapse against the SwiftUI `List`. This caveat is the reason for the ADR.
- The inline title is additionally forced on when the `/days` sheet rests at its
  **XS detent** (`sheetDetentChange` index 0): at a ~10%-height peek the list is
  too short to scroll, so the scroll trigger can never fire and the large title
  has no room — the collapse is therefore driven by `scrolledPastThreshold OR
  detentIsXS`, reusing the same cross-fade. Leaving XS reverts to the scroll
  state. The settle-only nature of `sheetDetentChange` (it fires on `isStable`)
  means the cross-fade lands as the detent comes to rest, which is accepted.
- This XS-detent requirement was the occasion to re-evaluate moving the title to
  native `headerLargeTitle`. It was **rejected again** for the original reason —
  the SwiftUI `List` is not the navigation controller's content scroll view, so a
  native large title would never collapse on scroll — and additionally because a
  native large title is just the trip-name string and cannot carry the custom
  `dates · countdown-pill` line. The hybrid stands.
