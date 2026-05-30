# Single-page app shell with a store-driven Displayed Trip

## Status

accepted — revises two decisions in PRD #38 (Navigation & app shell; Trip view layout / Day panel).

## Context

PRD #38 specified that the app become "a single stack rooted at one parametrized
**Trip view**", where tapping a Trip in the trips sheet **pushes** `/trip/[id]`
on top of the stack, and that the days list be an in-page glass panel that
"scrolls up over the fixed map — **no snap points and no bottom-sheet
dependency**". The codebase was left mid-migration between this and an older
shape (`app/trip/[id]/index.tsx` + `app/trip/[id]/days.tsx`, where the days list
is a native `formSheet` auto-presented over a per-trip map route).

## Decision

The app is a **single page**: `app/index.tsx` renders the map, and the days list
is a **permanent native `formSheet`** (`/days`) auto-presented over it. The trip
shown is in-memory store state — the **Displayed Trip** (`displayedTripId`) — not
a route param. Both the map and the `/days` sheet compute
`effectiveTripId = displayedTripId ?? resolveActiveTrip(...).tripId`. Switching
trips (trips-sheet selection, jump-back) **mutates that state and reuses the same
page** rather than pushing a new route. `displayedTripId` is never persisted, so a
cold start always shows the resolved default. `app/trip/[id]/index.tsx` and
`app/trip/[id]/days.tsx` are retired; the item editor and new-trip remain
param/modal routes.

This reverses (a) "push a parametrized route per trip" in favour of
"displayed-trip-is-state, one reused page", and (b) "no bottom-sheet dependency"
in favour of a native `formSheet` (permanent, resize-only between detents) for the
days panel — chosen for the native grabber/blur/detent behaviour. The trips sheet
stacks on top of the permanent days sheet.

## Consequences

- Favorite chrome no longer keys off "home vs pushed" (there is no push): overflow
  (Export/Delete of the Displayed Trip) is always visible; the star is hidden at
  home and only the trips sheet can unfavorite; a neutral back-arrow (jump-back)
  and the star appear only while the Displayed Trip differs from the resolved
  default. See [Displayed Trip](../../CONTEXT.md#displayed-trip).
- Deleting the Displayed Trip clears `displayedTripId` and re-resolves the default
  (clearing `activeTripId` too if it was the favorite) — the single-page
  reinterpretation of PRD #43/#44, with no route to pop.
- Two stacked native `formSheet`s (days → trips) is accepted.
- The days `formSheet` is permanent (resize-only between detents, swipe-to-dismiss
  disabled). In the empty state (no resolved default Trip) it still presents, at
  its low detent, showing a "Create trip" affordance (and Import) rather than
  disappearing.
- Archived (Past) Trips selected from the Archived sheet route through the same
  `setDisplayedTrip` path, dismissing the whole sheet stack; they are shown
  non-favoritable (no star) but editable, with overflow + back-arrow present.
