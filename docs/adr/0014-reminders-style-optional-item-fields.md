# Reminders-style progressive disclosure for optional item fields

## Status

accepted — supersedes the time-row mechanism described in
[ADR-0003](0003-native-forms-over-custom-rn.md).

## Context

The item editor (`components/item-editor.tsx`) presented every field at once in
a single dense `Section`: a trailing-aligned Name, a separately-labelled Notes
field, and "Add time" / "Add location" affordances. It read as a generic form
rather than "the default iOS way", and showed empty controls for fields the
traveller had not filled in. The brief was to take inspiration from the
full-page Apple **Reminders** creation form, especially its handling of
**optional fields**.

## Decision

Restructure the editor around Reminders-style progressive disclosure:

- **Combined title/notes cell.** Name and Notes share one top `Section` cell,
  both leading-aligned, no field labels — Name on the first line (slightly
  larger, semibold), Notes flowing directly underneath. Extracted note links
  render inside the same cell.
- **Time is a toggle-expand row.** A `Toggle` expresses the optional/"unset"
  state: off = no time; switching on defaults to `09:00` and expands an inline
  time picker; tapping the row *body* (not the switch) collapses the picker to a
  locale-formatted value subtitle under the "Time" label; switching the toggle
  off clears the time. Opening an existing timed item starts on, collapsed,
  showing the value.
- **Location stays an opt-in affordance.** Because it pushes a full-screen map
  picker (ADR-0012) it cannot expand inline, so it keeps the "Add location" →
  address-with-clear row.
- **Icon-led detail rows.** Date (`calendar`), Time (`clock`) and Location
  (`map`, matching the itinerary's location glyph) carry a leading monochrome SF
  Symbol — no colored Reminders badges, so the category accent stays the only
  color system. Category keeps its row (now a `segmented` picker) with no
  leading icon; Date stays a mandatory compact `DatePicker`.
- **Validation by disabled Save.** The Name-required rule is enforced by
  disabling the Save toolbar button while Name is empty, rather than a
  section-footer error. Since Time is now a native picker it can only ever
  produce a valid `HH:mm`, so the react-hook-form/zod footer-error plumbing is
  removed entirely.
- **Checklist** remains its own section at the bottom; **Delete** stays below it
  in edit mode.

## Consequences

- The "unset" time state now lives in the toggle, not in a placeholder + inline
  Clear. This **reverses the explicit warning in ADR-0003** against changing the
  time row — the optionality guarantee is preserved, only its mechanism changed.
- No `CONTEXT.md` change: this is presentation only; no domain term moves.
