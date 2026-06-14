# The trip route follows real roads, computed on-device and cached

## Status

accepted — governs the [Trip route](../../CONTEXT.md#trip-route); extends the
"local-first core, best-effort network at the edges" tension first set by
[ADR-0007](0007-share-capture-network-coordinate-resolution.md) against
[Local-first storage](../../CONTEXT.md#local-first-storage).

## Context

The map joins a trip's [pins](../../CONTEXT.md#pin) with a line. Until now that
line was a straight polyline between consecutive coordinates — fine as a sketch,
but for a road-trip planner the natural reading of "the route" is the roads you
will actually drive. Straight lines mislead: they cut across mountains and water
and give no sense of real travel distance between stops.

`expo-maps` draws polylines from coordinates we hand it but exposes **no
directions/routing API**, so road geometry has to come from somewhere else.
Three forces pull on the choice:

- **Local-first.** The app stores everything on-device and makes no network call
  in its core flows. ADR-0007 already opened a narrow, best-effort networking
  edge (Photon geocoding, Google redirect resolution); routing is a second such
  edge, not a new philosophy.
- **Cost and keys.** A road-trip with N pins has N−1 legs. An external routing
  HTTP API (Mapbox, OpenRouteService, OSRM) means a new outbound host plus an
  API key/token to provision and protect.
- **Existing native pattern.** The repo already ships Swift Expo modules
  (`modules/smart-import`), so a native routing module is on-brand, not a new
  kind of moving part.

## Decision

The [Trip route](../../CONTEXT.md#trip-route) is drawn as road-following legs:

1. **Apple MKDirections via a native Expo module.** A new Swift module wraps
   `MKDirections` (driving), returning each leg's road polyline as coordinates
   that feed the existing `expo-maps` polyline prop. No API key, no new external
   host — MapKit is already linked.
2. **Straight-line fallback per leg.** When a leg can't be routed — offline, or
   no drivable path (over water, a flight hop) — that leg falls back to the
   straight line it drew before, styled so it reads as approximate. The route is
   never missing.
3. **Persisted route cache.** Each computed leg is cached to a dedicated
   on-device cache file keyed by its endpoint coordinates — **not** in the trip
   JSON, so `TripSchema` and its `schemaVersion` stay clean. Cached legs render
   instantly on relaunch and survive going offline; a cache entry is invalidated
   when either endpoint moves.

## Consequences

- Routing depends on connectivity at compute time, but only the *first* time a
  leg is seen: the persisted cache means the common case (re-opening a planned
  trip) needs no network and works offline.
- MapKit throttles bursts of `MKDirections` requests, so legs are computed
  lazily and the cache absorbs repeats; a trip is never routed all at once on
  every render.
- The cache is a derived artifact, deliberately kept out of the trip file. Trips
  stay portable and the schema unchanged; a wiped cache only costs a recompute,
  never data.
- Driving is the only mode in v1 — it's a road-trip app. Non-driving legs simply
  fall back to straight lines rather than offering walking/transit routing.
- Reversing to straight-line-only means deleting the module and cache and reading
  pins directly again; the fallback path already is that behaviour, so the route
  degrades to the old look rather than breaking.
