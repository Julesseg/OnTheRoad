# Collapse the four Item types into one, with category as cosmetic metadata

## Status

accepted — supersedes the four-type discriminated union and the
per-*type* identity established in [ADR-0003](0003-native-forms-over-custom-rn.md)
(the `Location`/`Accommodation`/`Activity`/`Note` union and its type picker).
The CONTEXT.md [Item](../../CONTEXT.md#item) glossary entry is rewritten
alongside the implementing schema change, not ahead of it.

## Context

ADR-0003 modelled an [Item](../../CONTEXT.md#item) as a discriminated union of
four types, each with its own field set and a mandatory up-front type choice.
In practice the structure earned little: travellers picked a type before they
knew what they were entering, several per-type fields (`checkIn`/`checkOut`,
`confirmationNumber`, `duration`) were rarely used, and `Note` was the odd one
out with no `name`. The standing brief is to make this *simpler*. Two fields
were also dead weight — `attachments` (validated but with no read or write UI)
and per-`Day` `notes` (rendered but never editable).

## Decision

Replace the union with a **single Item entity**:

```
id · name* · category · time? · location?{ address?, lat?, lng? } · notes? · checklist?
```

- **Category is cosmetic metadata, not a discriminator.** A fixed enum —
  **Activity** (default) / **Location** / **Stay** / **Meal** / **Note** —
  selected with a segmented `Picker` (`pickerStyle('segmented')`). It drives
  only the SF Symbol + accent (the `item-identity` machinery, re-keyed from
  type to category); it never gates which fields are valid. A stay is an item
  categorised *Stay*; a packing list is any item carrying a checklist.
- **Location is one poly-input field.** A single search-style row (rebuilt in
  `@expo/ui/swift-ui` to match the other sheets) interprets what you type:
  `lat, lng` → coords; a maps URL → resolved to coords; free text → a plain
  address, with Photon place results offered below (each carrying address +
  coords). A drop-a-pin map affordance and a clear (✕) button round it out.
  `address` and `lat`/`lng` stay stored separately but are presented as one
  field; the row shows the address when present, else the coordinates.
- **Checklist** is an optional `[{ id, label, checked }]`. Entries are ticked
  **inline in the itinerary and persisted immediately** (autosaved,
  independent of the editor's Save/Cancel); the editor owns adding, editing,
  and reordering labels.
- **Date lives in the editor.** A required `DatePicker` clamped to the trip
  span replaces the "Change day" swipe action and the `MoveToDayOverlay`; on
  save a changed date moves the item to the matching Day. There is no
  unscheduled bucket — every item has a date within the trip.
- **Dropped:** `duration`, `attachments`, per-`Day` `notes`, and the up-front
  type picker.

**Migration v2 → v3** (`migrateTripData` grows into a per-item transform):
type maps to category mechanically; the lossy fields are *preserved into
`notes`* rather than discarded — Stay `checkOut`/`confirmationNumber` and
Activity `duration` are prepended to `notes`; an old `Note`'s `text` becomes a
first-line `name` plus full-text `notes`.

## Considered options

- **Keep the four-type union (ADR-0003).** Rejected: the up-front type choice
  and rarely-used per-type fields are the friction this overhaul removes.
- **Keep `Accommodation` as a third structured type** for check-in/out +
  confirmation. Rejected: full collapse was chosen; those fields fold into
  `notes`, trading structure for one uniform shape.
- **Free-text categories.** Rejected: every value needs a curated icon/accent,
  which open-ended categories can't carry.
- **Editor-only checklist ticking** (persist on Save). Rejected: a checklist
  you can't tick without entering edit mode isn't a checklist; in-trip ticking
  is the whole point.

## Consequences

- The migration is **lossy-but-preserved**: structured Stay/Activity data
  survives only as free text in `notes`, and is not recoverable as structured
  fields. This is deliberate and irreversible once trips are re-saved at v3.
- Maps/navigation and the next-up logic key off the **presence of a location**,
  not the item type — any category can now carry a location (or not).
- The Photon network dependency (`lib/photon.ts`) and maps-URL resolution
  (`resolveMapsUrl`) are **kept**, folded into the one location field.
- **Activity** is demoted from a type to a category *value*; the CONTEXT.md
  terms `Item`, `Location`, `Activity`, `Accommodation`, and `Note` are
  rewritten with the schema change, and `item-identity` is re-keyed by
  category. A reader coming from ADR-0003 should treat its four-type model and
  Place/Stay/Activity/Note labels as superseded here.
