# Address-only items resolve to coordinates via Photon at two call sites

## Status

superseded by [ADR-0012](0012-map-centered-location-picker.md). Both call sites
it defined are gone: the Location Picker's silent geocode-on-confirm is replaced
by the map-centered picker's *visible* search-and-pick resolution (ADR-0012), and
the Smart Import fire-and-forget pass is dropped because the Smart Import feature
is being retired. Kept for the historical record of why address-only items exist
and why on-load enrichment was rejected — that reasoning still holds.

Original status: accepted — governed coordinate enrichment for
[Items](../../CONTEXT.md#item) that carry an address but no `lat`/`lng`.

## Context

An item's `location` field holds `{ address?, lat?, lng? }`. Only items with
both `lat` and `lng` render as [Pins](../../CONTEXT.md#pin) on the map
(`tripRouteCoords` and `tripLegs` both gate on coordinates). Two ingestion
paths regularly produce address-only items:

- **Smart Import**: the on-device model outputs addresses as text; writing
  coordinates would require a network call mid-generation, which
  [ADR-0006](0006-smart-import-on-device-only.md) ruled out to preserve the
  local-first guarantee.
- **Location Picker**: when a user types or pastes an address without selecting
  a Photon search result and confirms, there are no coordinates yet.

A third option — re-geocoding every address-only item on each trip load — was
considered and rejected: it cannot distinguish "geocoding was attempted and
failed, address-only is the intentional last resort" from "never geocoded yet",
so it would silently retry unresolvable addresses on every load.

## Decision

Coordinates are resolved at exactly two call sites, using the existing Photon
service (`lib/photon.ts`). In both cases the first result is accepted
automatically, failure is silent, and the item remains address-only — no
retry, no error shown.

**1. Location Picker — inline on confirm**

When the user confirms a location that carries an address but no coordinates,
the picker attempts a Photon geocode before dismissing, showing a brief
"Resolving…" indicator. On success the picker returns
`{ address, lat, lng }`; on failure (no results, network error) it returns
`{ address }` — address-only as a stable last resort. The confirmed state is
never retried on subsequent loads.

**2. Smart Import — fire-and-forget after the trip is saved**

After `smartImport` writes the new trip to disk, it fans out Photon geocodes
for every address-only item (concurrency capped at 3, matching the
`resolveLegs` burst pattern). Resolved coordinates are written back into the
trip JSON via an atomic save. Items that fail to resolve stay address-only
permanently.

In both cases resolved coordinates are written into `item.location.lat/lng` in
the trip JSON — not a separate cache — so they travel with export and all
existing consumers (map, route legs, directions) see them without changes.

## Consequences

- **No on-load enrichment pass.** A trip load never triggers geocoding. Items
  that arrived address-only (JSON import, old data, confirmed picker fallbacks)
  remain without a pin until the user explicitly re-opens the item in the
  editor and re-confirms the location.
- **Auto-pick first result.** Photon may return the wrong candidate for
  ambiguous addresses (e.g. "Paris" without country context). The user corrects
  this by opening the item and picking a location explicitly via the picker's
  search flow. This is the same "save first, fix later" stance as Smart Import
  overall.
- **Smart Import now makes network calls post-save.** ADR-0006 ruled out
  network calls *during* generation to preserve local-first for the import
  itself; the post-save geocode pass is a narrow exception — the trip already
  exists, the pass is best-effort, and failure leaves the trip intact.
- **JSON-imported trips with address-only items stay without pins** until the
  user edits them. This is a known gap; a future "Resolve Locations" action on
  the trip could fill it if it proves painful in practice.
