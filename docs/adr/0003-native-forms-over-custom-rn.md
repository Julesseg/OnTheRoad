# Native @expo/ui forms over custom RN, trading away the "airy" brief

## Status

accepted — extends the native-surface direction of [ADR-0002](0002-hybrid-native-trip-sheet-header.md) to the form layer.

## Context

The Trip form (`components/trip-form.tsx`) and the Item editor
(`components/item-editor.tsx`) are the last hand-rolled React Native surfaces in
the app: bare `TextInput`/`View`/`TouchableOpacity` with hardcoded `#007AFF`
borders and gray labels. Everything around them — the itinerary, the trips
sheet, settings, archived — is native SwiftUI via `@expo/ui/swift-ui` (`List`,
`Section`, `Menu`, `SwipeActions`, SF Symbols, glass, progressive blur). The
forms read as **bland** precisely because they look like a generic web-ish form
bolted onto an otherwise native-feeling app.

The redesign brief asked for "a simple design with **a lot of negative space**,
some **cute items**, and **custom fields dedicated to different data types**."
That brief contains an internal tension: native iOS grouped forms are
deliberately *dense* (fixed-height inset rows), which is the opposite of "lots
of negative space." So the foundational fork was: rebuild on native `@expo/ui`
forms (cohesive, free iOS polish, but dense) versus a bespoke airy custom-RN
layout (full control over whitespace, but diverging from the native look and
self-maintained).

`@expo/ui/swift-ui` turned out to ship a rich form toolkit — `Form`, `Section`,
`TextField`, `SecureField`, `DatePicker`, `Picker`, `Stepper`, `Toggle`,
`LabeledContent`, `ContentUnavailableView` — enough to express "custom fields per
data type" and "cute" identity natively.

## Decision

Rebuild both forms on native `@expo/ui/swift-ui`, and **deliberately drop the
"lots of negative space" requirement** in favor of native cohesion. The brief's
other goals are reinterpreted into native-form terms:

- **Cute = per-type identity + warmth, not whitespace.** Each [Item](../../CONTEXT.md#item)
  type gets a fixed SF Symbol + accent color (Location = terracotta `mappin`,
  Accommodation = indigo `bed.double`, Activity = green `figure.hiking`, Note =
  warm-gray `note.text`), surfaced in a 2×2 colorful card-grid type picker
  (labelled **Place / Stay / Activity / Note**), section headers, and field
  accents. Plus `ContentUnavailableView` empty states and warm copy in the
  rounded system font. Accents stay clear of destructive-red (`#FF3B30`) and
  action-blue (`#007AFF`).
- **Custom fields per data type, using native controls.** Duration → h/m wheel
  `Picker` (still stored as whole minutes — no schema change); trip dates → two
  compact expanding `DatePicker` rows; times → native compact `DatePicker` with
  an inline same-row Clear to preserve the optional/"not set" state; coordinates
  → keep the existing custom map `CoordsPicker`.
- **Validation** → react-hook-form + zod with inline Section-footer errors; the
  Trip form migrates onto this shared pattern (today it uses ad-hoc `Alert`s).

## Considered options

- **Custom airy RN layout** with a new token system (spacing scale, rounded
  font, accent palette). Rejected: would satisfy "negative space" literally but
  re-introduce the very mismatch that made the forms look bland, and put all the
  styling and a11y back on us to maintain.
- **Hybrid** — airy custom shell wrapping native controls. Rejected: most
  integration glue for a middle-ground look; the native-cohesion win was judged
  more valuable than reclaiming whitespace.
- **Keep custom RN, just restyle.** Rejected: lipstick on the same structural
  mismatch.

## Consequences

- An optional time can never be expressed by a native picker's *value* (it always
  has one); the "unset" state lives entirely in the surrounding row (placeholder
  + inline Clear). A future reader must not "simplify" the time rows down to a
  bare `DatePicker` — that silently destroys optionality for Location/Activity
  `time` and Accommodation `checkIn`/`checkOut`.
- The forms will look **native and dense**, not airy. This is intentional and is
  the main reason for this ADR: someone re-reading the original brief will ask
  why the forms aren't full of negative space — the answer is this trade.
- Item-type display labels (Place/Stay/Activity/Note) diverge from the canonical
  domain terms; the mapping is recorded in [CONTEXT.md](../../CONTEXT.md#item).
