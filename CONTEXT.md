# On the Road — Context

The domain glossary for this repo. When code, issues, plans, or tests name a
domain concept, use the term as defined here rather than a synonym. This is a
single-context repo, so there is one `CONTEXT.md` at the root; architectural
decisions live in `docs/adr/` ([0001](docs/adr/0001-single-page-displayed-trip.md)).

On the Road is a local-first, iOS-only road-trip itinerary planner. A user
builds a **Trip**, the app lays out one **Day** per calendar date, and the user
fills each day with ordered **Items** (where to go, where to stay, what to do).

## Glossary

### Trip

The top-level itinerary and the unit of storage: one JSON file per trip. A trip
has a `title`, a `startDate` and `endDate` (the inclusive span it covers),
an ordered list of `days`, an optional [wallpaper](#wallpaper), a
`schemaVersion`, and `createdAt` / `updatedAt` timestamps. Defined by
`TripSchema` in `lib/schema.ts`.

Prefer **Trip** over "journey" or "vacation".

### Wallpaper

An optional personal cover photo for a trip, rendered as the background of the
trip's card on the Trips tab (beneath its glass layer). Stored durably on-device
as `trips/<id>/wallpaper.jpg` so it survives the source being removed from the
photo library; `trip.wallpaperUri` holds that path **relative** to the documents
directory, never the picker's `ph://` URI. Absent means no wallpaper — the card
renders on a plain background. Copied in on pick by `saveWallpaper` and resolved
for display by `wallpaperDisplayUri` (`lib/storage.ts`, path in `lib/wallpaper.ts`).

Prefer **Wallpaper** (or "cover photo" in user-facing copy) over "background".

### Schema version

The `schemaVersion` stamped on every trip file, bumped when the persisted shape
changes. On read, a stored trip is run through `migrateTripData`
(`lib/trip-migrate.ts`) to upgrade it to `CURRENT_SCHEMA_VERSION` before
validation, so older files keep loading. v1 → v2 added the optional
[wallpaper](#wallpaper); a v1 trip upgrades with no wallpaper. v2 → v3
replaced the four-type discriminated-union Item with the unified Item (see
[ADR-0004](docs/adr/0004-single-item-type-category-as-metadata.md)); every
v1/v2 item is transformed per-item, with lossy fields preserved into `notes`.

### Trip Summary

The lightweight projection of a trip — `id`, `title`, `startDate`, `endDate`,
and `wallpaperUri` — kept in the [App State](#app-state) so list screens (Trips,
Upcoming) can render (including the [wallpaper](#wallpaper)) without loading
every full trip file. The full trip is loaded on demand and
cached in the store's `loadedTrips`.

### Day

A single calendar **date** within a trip. Holds an ordered list of `items`.
Days are generated and kept in sync by
`reconcileDays` (`lib/trip-days.ts`): on create it builds one empty day for
every date from `startDate` through `endDate` inclusive, and when a trip's dates
change it is **calendar-anchored** — in-range days are kept intact, newly
in-range dates are added as empty days, and out-of-range days are dropped (it
also reports any dropped day that still holds items so the edit flow can warn
before discarding, since items are never auto-moved). A day is identified by its
own `id`, not by its date.

Prefer **Day** over "leg" or "stage".

### Item

A single entry on a day. A **single unified entity** (not a discriminated union)
defined by `ItemSchema` in `lib/schema.ts`:

```
id · name* · category · time? · location?{ address?, lat?, lng? } · notes? · checklist?[{ id, label, checked }]
```

- `name` is required (non-empty). All other fields are optional.
- `category` is a fixed enum — **Activity** (default) · **Location** · **Stay**
  · **Meal** · **Note** — that drives only the SF Symbol and accent; it never
  gates which fields are valid. Any category can carry a location or checklist.
- `location` bundles `address` and/or coordinates (`lat` / `lng`) into one
  sub-object; this is the single source of truth for maps navigation.
- `checklist` is an array of `{ id, label, checked }` entries (optional);
  items are ticked inline in the itinerary and persisted immediately.
- The v2 fields `duration`, `checkIn`, `checkOut`, `confirmationNumber`, and
  `attachments` do not exist in v3; they were preserved into `notes` on
  migration.

Each category carries a fixed visual identity — SF Symbol + accent — defined in
`item-identity.ts` (Activity = green, Location = terracotta, Stay = indigo,
Meal = amber, Note = warm gray). In user-facing copy the categories are labelled
**Activity**, **Place** (Location), **Stay**, **Meal**, and **Note**.

Prefer **Item** over "entry", "event", or "stop". Prefer **category** over
"type" when discussing the cosmetic classification.

### Item time

The single comparable time an item happens at, used for ordering and for picking
the [next item](#today-selection--next-item): the `time` field on any item
(`itemTime` in `lib/item-display.ts`). Items without a time sort after timed
items in their original relative order. All categories share the same `time`
field — there is no per-category time synonym.

### App State

The global persisted state, stored in `state.json` separately from trip files:
`activeTripId`, the array of [Trip Summaries](#trip-summary), the
[preferred maps app](#preferred-maps-app), and `lastUpdated`. Defined by
`AppStateSchema`.

### Displayed Trip

The trip currently shown on the home screen. Distinct from the
[Favorite](#app-state) (the explicit pin) and from the resolved default (the
trip the app opens on automatically). Selecting a trip from the sheet makes it
the Displayed Trip; the app reverts to the resolved default on a cold start. See
[ADR-0001](docs/adr/0001-single-page-displayed-trip.md).

### Trip status

A trip's position relative to today, derived from its dates (`tripStatus` in
`lib/date-utils.ts`): **In progress** (today is within the span), **Upcoming**
(starts in the future), or **Past** (already ended). Shown as a badge on the
Trips list.

### Today selection / Next item

How the **Upcoming** tab decides what to spotlight. The *current or next* trip is
the in-progress trip, else the soonest trip that hasn't ended yet. Within that
trip, the **today selection** (`selectTodayDay` in `lib/today.ts`) resolves to a
day plus a `kind` of `today`, `before`, or `after` (with `daysAway` when the trip
hasn't started). When the trip is in progress, the **next item** (`nextItemId`)
is the earliest item whose time is at or after now — the one the traveller is
heading to next.

### Preferred maps app

The maps application used to open an address or coordinate: **Apple Maps**,
**Google Maps**, or **Waze** (`MapsApp` in `lib/schema.ts`). Apple Maps always
ships with iOS; the others are probed for via URL schemes. A stored preference
pointing at an uninstalled app is reconciled back to Apple Maps so it can never
dead-end (`lib/maps.ts`).

### Import / Export

A trip can be shared as standalone JSON. **Import** reads a `.json` file,
validates it against `TripSchema`, and assigns a **fresh id** so it never
overwrites an existing trip; invalid files yield a human-readable error naming
the offending field. **Export** serializes a trip to pretty-printed JSON in the
cache directory for sharing (`lib/trip-io.ts`, `lib/storage.ts`).

### Local-first storage

All data lives on the device as JSON files in the app's document directory — no
account, server, or network. `state.json` holds the [App State](#app-state) and
`trips/<id>.json` holds each trip. Writes are **atomic**: data is written to a
`.tmp` file and renamed over the destination, so a crash mid-write can't corrupt
an existing file (`atomicWrite` in `lib/storage.ts`).
