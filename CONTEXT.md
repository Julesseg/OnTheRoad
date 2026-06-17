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
`item-identity.ts`, with each accent drawn from the Ember ramp (Activity =
Sage, Location = Olive, Stay = Steel, Meal = Gold, Note = Mauve; see ADR-0005).
In user-facing copy the categories are labelled
**Activity**, **Place** (Location), **Stay**, **Meal**, and **Note**.

Prefer **Item** over "entry", "event", or "stop". Prefer **category** over
"type" when discussing the cosmetic classification.

### Item time

The single comparable time an item happens at, used for ordering and for picking
the [next item](#today-selection--next-item): the `time` field on any item
(`itemTime` in `lib/item-display.ts`). Items without a time sort after timed
items in their original relative order. All categories share the same `time`
field — there is no per-category time synonym.

### Trip route

The path drawn on the map connecting a trip's located [Items](#item) in
itinerary order — one [pin](#pin) per item that carries coordinates, joined by
**legs** (one leg between each consecutive pair of pins). A leg follows real
roads (driving) when a route can be found, and falls back to a straight line
when it can't — offline, or where no drivable path exists (an over-water hop, a
flight). See [ADR-0009](docs/adr/0009-road-following-trip-route.md). When a
[Day](#day) filter is active, the off-day pins and legs are **dimmed** rather
than hidden, so the whole journey stays visible with the chosen day emphasised.

Prefer **route** for the line on the map and **leg** for one segment of it.
Reserve **itinerary** for the day-by-day [Item](#item) list shown in the day
sheet — the route and the itinerary are two surfaces onto the same trip, not
synonyms.

### Pin

A map marker for a single located [Item](#item) (one whose `location` carries
coordinates). Tapping a pin reveals a lightweight **info card** for that item
(its name, category, time, and a notes snippet, with a way through to the full
item); tapping empty map or a non-trip point of interest reveals nothing. The
map is a view onto the trip, not a place browser.

Distinct from a [result pin](#result-pin), which is a transient search candidate
in the [Location Picker](#location-picker), not yet an Item.

### Result pin

A transient marker for a single search candidate inside the
[Location Picker](#location-picker) — a Photon result, a pasted coordinate, or a
resolved maps link — drawn in the accent colour over the trip's own greyed
[Pins](#pin). It is not yet an [Item](#item): it becomes a `location` only if the
user selects it and confirms. Prefer **result pin** over "candidate"; reserve
[Pin](#pin) for a located Item already on the trip.

### Location Picker

The map-centered surface for choosing an [Item](#item)'s `location`: a
full-screen map (the trip's [Pins](#pin) and route shown greyed as context) with
a search sheet over it. Typing surfaces [result pins](#result-pin) the traveller
picks from, so a confirmed location almost always carries coordinates; a pasted
coordinate or maps link resolves to a result pin too, and a pin can be dropped by
hand. Confirming a plain address with no coordinates — `{ address }` — is the
deliberate **last resort**, offered only as a standing fallback row for when
there is no point to show on the map. See
[ADR-0012](docs/adr/0012-map-centered-location-picker.md).

### User location

The device's own position, shown as the standard blue dot when the traveller
grants when-in-use location permission (requested as the map first appears). A
themed control re-centres the map on it — distinct from re-centring on the
[Trip route](#trip-route), which frames all of a trip's pins.

### App State

The global persisted state, stored in `state.json` separately from trip files:
`activeTripId`, the array of [Trip Summaries](#trip-summary), the
[preferred maps app](#preferred-maps-app), the [appearance](#appearance), and
`lastUpdated`. Defined by `AppStateSchema`.

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
Trips list. Past trips are the same date-derived set the UI surfaces as
**Archived** (`endDate < today`; `partitionTrips` in `lib/trip-partition.ts`) on
the Archived screen — there is no separate archive flag. Prefer **Past** for the
status and **Archived** for that user-facing bucket; they name one set.

### Today selection / Next item

How the **Upcoming** tab decides what to spotlight. The *current or next* trip is
the in-progress trip, else the soonest trip that hasn't ended yet. Within that
trip, the **today selection** (`selectTodayDay` in `lib/today.ts`) resolves to a
day plus a `kind` of `today`, `before`, or `after` (with `daysAway` when the trip
hasn't started). When the trip is in progress, the **next item** (`nextItemId`)
is the earliest item whose time is at or after now — the one the traveller is
heading to next.

### Day filter

The lens that narrows the trip to a single [Day](#day): the itinerary list shows
only that day's [Items](#item), and on the map the other days' [pins](#pin) and
legs are **dimmed** rather than hidden ([Trip route](#trip-route)), so the whole
journey stays visible with the chosen day emphasised. For an **In progress**
trip it defaults to today and is offered as a toggle in the day sheet; for an
**Upcoming** trip nothing is filtered by default, and the filter is engaged by
tapping a Day's header, at which point its toggle appears. Distinct from the
[Today selection](#today-selection--next-item), which only *spotlights* a day;
the Day filter actually restricts what is shown.

Prefer **Day filter** over "today filter" in user-facing language, even though
the override that backs it is keyed on today by default.

### Preferred maps app

The maps application used to open an address or coordinate: **Apple Maps**,
**Google Maps**, or **Waze** (`MapsApp` in `lib/schema.ts`). Apple Maps always
ships with iOS; the others are probed for via URL schemes. A stored preference
pointing at an uninstalled app is reconciled back to Apple Maps so it can never
dead-end (`lib/maps.ts`).

### Appearance

The user's override for how the app resolves light vs dark: **System**
(default — follow the OS), **Light**, or **Dark** (`AppearanceMode` in
`lib/schema.ts`). Persisted in the [App State](#app-state) and applied
app-wide on launch and on change via React Native's
`Appearance.setColorScheme()` (`applyAppearance` in `lib/appearance.ts`), so
themed components and native surfaces (alerts, grouped lists) all follow it
(see [ADR-0005](docs/adr/0005-ember-palette-accent-layer.md)).

Prefer **Appearance** over "theme toggle" or "dark mode setting".

### Import / Export

A trip can be shared as standalone JSON. **Import** reads a `.json` file,
validates it against `TripSchema`, and assigns a **fresh id** so it never
overwrites an existing trip; invalid files yield a human-readable error naming
the offending field. **Export** serializes a trip to pretty-printed JSON in the
cache directory for sharing (`lib/trip-io.ts`, `lib/storage.ts`). Import is the
*exact restore* of an On the Road file. It is also the landing point for the
[Schema Prompt](#schema-prompt) round trip — the JSON an external LLM produces
from a [Planning Document](#planning-document) re-enters here through the same
`TripSchema` gate.

### Planning Document

Any unstructured free-text description of a trip — written anywhere (Notes, an
email, a doc) in no particular format. The source material the user pastes into
an external LLM together with the [Schema Prompt](#schema-prompt); the app never
ingests it directly.

Prefer **Planning Document** over "freeform document" (collides with the Apple
Freeform app, which is not involved).

### Schema Prompt

The app's one AI-assisted on-ramp for structuring a
[Planning Document](#planning-document) into a [Trip](#trip): a copyable,
ready-to-paste prompt bundling the full persisted trip JSON schema and output
instructions. The user copies it from the [Import](#import--export) sheet,
pastes it — together with their Planning Document — into any LLM of their
choice, and brings the LLM's JSON output back in through the same
[Import](#import--export). The app makes **no network call** and runs no model
itself; the user carries the text across by hand. Built by `buildSchemaPrompt`
(`lib/schema-prompt.ts`), which embeds a worked example that itself passes the
strict `TripSchema` gate — the prompt describes the *full* persisted shape
(uuids, ISO timestamps, `schemaVersion`) precisely because its output re-enters
through Import's strict validation, not a lenient draft path.

There is no on-device generation: an earlier on-device-model route (Apple
Intelligence Foundation Models) was dropped because the small model could not
structure real planning documents reliably, leaving the Schema Prompt as the
single AI path (see
[ADR-0012](docs/adr/0012-drop-on-device-smart-import-for-schema-prompt.md)).

Prefer **Schema Prompt** over "export schema", "LLM template", or "AI import".

### Share Capture

A fourth way content enters the app: a single link or place shared **from the
iOS system share sheet** (Google Maps, Apple Maps, Safari, …) becomes one
[Item](#item) — not a whole trip. This is the line that separates it from the
[Import](#import--export) family, which always produces a [Trip](#trip): Import
structures a *trip*, Share Capture captures a single *item*. A
native iOS **Share Extension** grabs the shared URL and/or text and hands it to
the main app (it does no parsing itself; see
[ADR-0008](docs/adr/0008-share-capture-thin-share-extension.md)); the app
classifies the payload into a
[Capture](#capture) and opens the [Share editor](#share-editor) prefilled.

Classification maps each source to one Item: a Google Maps or Apple Maps link
becomes a **Place** with address and — where resolvable — coordinates; any other
URL becomes an **Activity** with the link kept in `notes`; shared text carrying
no link becomes a **Note** (its first line the name). Link-less text is never
auto-geocoded — the user can switch it to a Place and pick a location in the
editor. Coordinates for map links are resolved best-effort over the network
(see [ADR-0007](docs/adr/0007-share-capture-network-coordinate-resolution.md)).
A capture is **never lost**: when nothing can be pinned the Item is still
created address-only, and the user always confirms in the editor before it is
saved.

User-facing share-sheet action: **Add to On the Road**. Prefer **Share Capture**
over "share import" or "quick add"; reserve [Import](#import--export) for
whole-trip ingestion.

### Capture

The best-effort draft that classifying a shared payload produces — a draft
[Item](#item) plus a resolved destination [trip](#trip) and [day](#day) — held
in the [Share editor](#share-editor) before the user confirms it. A Capture is
not yet persisted; only saving the editor turns it into a real Item.

### Share editor

The [Item](#item) editor variant used by [Share Capture](#share-capture): the
ordinary editor with a **trip selector added on top**, since a shared Item
arrives with no trip of its own. The trip defaults to the resolved active trip
(the [Favorite](#app-state) when still viable, otherwise the current-or-next
trip; `resolveActiveTrip` in `lib/active-trip.ts`); the day defaults to today
when that trip is in progress, otherwise its first day. Both stay editable
before saving. Lives at `app/share.tsx`, reached via the
`ontheroad://share?url=…&text=…` deep link (cold-start or warm); the shared
payload is turned into its draft Item by `classifyShare` in `lib/share-capture.ts`.

### Local-first storage

All data lives on the device as JSON files in the app's document directory — no
account, server, or network. `state.json` holds the [App State](#app-state) and
`trips/<id>.json` holds each trip. Writes are **atomic**: data is written to a
`.tmp` file and renamed over the destination, so a crash mid-write can't corrupt
an existing file (`atomicWrite` in `lib/storage.ts`).
