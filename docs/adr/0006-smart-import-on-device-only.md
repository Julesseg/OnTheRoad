# Smart Import runs on-device only — Foundation Models, no cloud fallback

## Status

superseded by [ADR-0012](0012-drop-on-device-smart-import-for-schema-prompt.md) —
the on-device route recorded here was dropped because the small model could not
structure real planning documents reliably; the Schema Prompt hand-off is now
the sole AI path. The body below is kept as the historical record of why
on-device was chosen first.

## Context

[Smart Import](../../CONTEXT.md#smart-import) needs an LLM to structure a
[Planning Document](../../CONTEXT.md#planning-document) into a schema-valid
Trip. Two genuine options existed: a cloud LLM (works on every device,
stronger model, but needs network, an API key, and billing) or Apple's
**Foundation Models framework** (the Apple Intelligence on-device model,
iOS 26+): free, offline, private, with **guided generation** that constrains
decoding to a `@Generable` schema — but only available on Apple
Intelligence-capable hardware (iPhone 15 Pro or later) with the feature
enabled and model assets downloaded, and limited to a ~4k-token context
window.

## Decision

Smart Import uses the on-device Foundation Models framework exclusively.
There is **no cloud fallback**: on devices without Apple Intelligence the
entry point shows an explanatory alert instead of working. The alert offers a
manual escape hatch — a **Copy Schema Prompt** button that puts a
ready-to-paste prompt (the trip JSON schema plus output instructions) on the
clipboard, so the user can have any LLM of their choice produce a valid trip
file and bring it back through the universal JSON Import. The app makes no
network call either way; the user carries the text across by hand. The model
generates a
*draft* schema (no UUIDs, timestamps, or `schemaVersion` — the app assigns
those deterministically), and the result passes through the same `TripSchema`
validation gate as JSON import before being saved.

## Consequences

- The local-first guarantee survives: no account, no network, no API key, and
  the user's planning text never leaves the device.
- The feature is hardware-gated; users on older iPhones get the Schema Prompt
  hand-off instead of in-app generation. The Schema Prompt must describe the
  *full* persisted schema (ids, timestamps, `schemaVersion`) since its output
  enters through JSON Import's strict `TripSchema` gate, not the lenient
  draft-schema path.
- The ~4k context window means long documents **fail loud** with a "split this
  up" message — no truncation, no chunking in v1.
- Item locations are captured as address strings only, never `lat`/`lng`:
  geocoding is a network service, which this decision rules out.
- Reversing this later means introducing API keys, billing, and a changed
  privacy story — meaningful cost, recorded here so it isn't drifted into.
