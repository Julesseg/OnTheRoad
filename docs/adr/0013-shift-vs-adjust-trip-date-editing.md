# Trip date editing is two explicit lossless modes: Shift vs Adjust

## Status

accepted — supersedes the implicit "calendar-anchored, drop out-of-range days,
warn-and-delete" behaviour previously baked into `reconcileDays`
(`lib/trip-days.ts`) and its Edit Trip alert.

## Context

A trip's [Days](../../CONTEXT.md#day) are one-per-calendar-date. Editing a
trip's `startDate`/`endDate` can leave existing [Items](../../CONTEXT.md#item)
on dates that no longer fall in the span. The old reconciliation matched days
by **exact date string**: out-of-range days were dropped, and the edit flow
showed a destructive alert ("these days have items — Delete or Cancel"),
telling the user to manually move items first.

Two problems made this hostile:

- **A pure shift orphaned everything.** Moving a trip a week later (Jul 1–3 →
  Jul 8–10, same length) matched no dates, so every day was dropped and every
  item slated for deletion — even though the itinerary's shape was unchanged.
- **The only rescue was manual, item-by-item, before editing.** The edit could
  silently destroy data on a single confirmation tap.

The exact-date model also contradicted the glossary's own statement that "a Day
is identified by its `id`, not its date."

## Decision

Changing an existing trip's dates is a dedicated, two-mode flow the traveller
chooses *before* entering new dates. Both modes are **lossless** — a date
change never deletes an Item.

- **Shift the trip** — the traveller picks only a new *start* date; the
  duration is locked. Every Day is re-dated by the same offset, keeping its id,
  items, and ordinal position (Day 1 stays Day 1). Bijective: nothing ever
  overflows, empties, or is dropped.
- **Adjust dates** — the traveller picks start and end freely. A Day whose date
  still falls in the new span keeps its items in place. Items on dates that now
  fall outside are carried to the **nearest surviving edge**: before the new
  start → appended to the first Day, after the new end → appended to the last
  Day, in ascending-date order and after that edge day's own items.

**UI placement.** The Edit Trip screen keeps name + cover inline; the two date
pickers become a single "Trip dates" row that opens a separate date screen
(mode choice → the right picker(s)). Confirming that screen *stages* the change
— the row updates to the new span — but persistence (including item moves)
happens with the rest of the edit on **Save**; cancelling Edit discards it.
Trip creation is unaffected: a new trip has no items, so it keeps the plain
start+end form.

## Considered Options

- **Date-anchored only (status quo).** Rejected: orphans every item on a pure
  shift, and its only safety valve is destructive.
- **Auto-infer shift vs adjust from the geometry** (e.g. equal length ⇒
  translate). Rejected: a partial-overlap edit (Jul 1–3 → Jul 2–4) is genuinely
  ambiguous — only the traveller knows whether they moved the trip or redefined
  its span. Inference would guess wrong half the time and silently.
- **Per-orphan-day relocation picker.** Rejected as the primary path: precise
  but tedious (a 14-day shift would demand 14 pickers); the whole-trip choice
  resolves the common cases in one tap.
- **Keep a delete path for orphans.** Rejected: relocating to the nearest edge
  is always recoverable (the user can delete piled-up items afterward in the
  itinerary), whereas a delete-on-edit is not.

## Consequences

- **Items are auto-moved by a date edit** — the opposite of the old "items are
  never auto-moved" rule. The [Day](../../CONTEXT.md#day) and
  [Shift / Adjust](../../CONTEXT.md#shift--adjust) glossary entries are updated
  to match.
- **No destructive date edit.** The warn-and-delete alert is removed;
  `reconcileDays` no longer reports `droppedDaysWithItems`.
- **Adjust can pile many days onto one edge.** Shrinking a long trip can crowd
  the first/last day; this is intentional (lossless beats tidy) and the user
  tidies up in the itinerary if they want.
- **`reconcileDays` now takes a mode.** Its signature and tests change from a
  single calendar-anchored function to the two-mode reconciliation above.
