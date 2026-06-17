# Drop on-device Smart Import; the Schema Prompt is the sole AI path

## Status

accepted — supersedes [ADR-0006](0006-smart-import-on-device-only.md), which
chose the on-device Foundation Models route this decision removes.

## Context

[ADR-0006](0006-smart-import-on-device-only.md) committed Smart Import to Apple's
on-device Foundation Models framework: a [Planning Document](../../CONTEXT.md#planning-document)
was structured into a [Trip](../../CONTEXT.md#trip) entirely on-device, with the
[Schema Prompt](../../CONTEXT.md#schema-prompt) — copy a prompt, paste it into
any external LLM, import the JSON it returns — kept only as the fallback for
hardware without Apple Intelligence.

In practice the on-device model was not good enough. Its small (~4k-token)
context window forced a brittle multi-pass generation scheme, and even within
that budget it could not reliably structure real planning documents into valid,
faithful trips — content was dropped, mislabelled, or misdated often enough that
the feature could not be trusted. The fallback we built for unsupported hardware
turned out to be the better product on *every* device.

## Decision

Remove on-device generation entirely. The **Schema Prompt** becomes the single
AI-assisted on-ramp: the user copies it from the Import sheet, pastes it together
with their Planning Document into any LLM of their choice, and brings the
resulting JSON back in through the ordinary [Import](../../CONTEXT.md#import--export)
gate. The on-device generation pipeline and its native modules (`modules/smart-import`,
`modules/smart-import-availability`, `lib/smart-import.ts`, `lib/smart-import-availability.ts`,
the paste-and-generate screen) are deleted; `lib/schema-prompt.ts` is kept and
promoted.

We deliberately **do not** replace the on-device model with a cloud LLM. The
obvious reaction to "on-device wasn't good enough" is "so call a hosted model" —
but that means an API key, billing, and the user's planning text leaving the
device, which breaks the local-first, no-network, no-account stance
([Local-first storage](../../CONTEXT.md#local-first-storage)). The Schema Prompt
keeps that stance intact: the app makes no network call, the user carries the
text across by hand, and they choose (and pay for) whatever model they already
use.

## Consequences

- The local-first guarantee is fully preserved — stronger than under ADR-0006,
  since no model runs in the app at all.
- The feature works identically on every device; the Apple Intelligence
  hardware gate and its availability probe disappear.
- Trip creation from notes is no longer one-tap — it's a manual round trip
  (copy, paste into an LLM, import). Accepted: the external models do the job
  the on-device one couldn't, and the step is rare.
- Reversing course later (re-introducing in-app generation, on-device or cloud)
  means rebuilding a native module or taking on the cloud trade-offs ADR-0006
  and this ADR both weighed — recorded here so it isn't drifted into.
