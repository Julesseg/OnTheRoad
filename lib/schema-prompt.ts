import { CURRENT_SCHEMA_VERSION, Trip } from './schema';
import { serializeTrip } from './trip-io';

/**
 * The Schema Prompt (see CONTEXT.md#schema-prompt). A ready-to-paste prompt that
 * bundles the full persisted Trip JSON schema with instructions, offered when
 * Smart Import is unavailable (no Apple Intelligence — see ADR-0006). The user
 * pastes it, together with their Planning Document, into any LLM; the LLM's JSON
 * comes back in through the ordinary JSON Import, which enforces the strict
 * `TripSchema` gate. The prompt therefore describes the *full* persisted shape —
 * uuids, ISO timestamps, and `schemaVersion` — not the lenient draft schema the
 * on-device path uses. The app makes no network call; the user carries the text
 * across by hand.
 */

// A concrete, importable trip the prompt tells the model to imitate. It exercises
// every field the model needs to emit correctly: uuids, the literal schemaVersion,
// ISO timestamps, multiple days, a timed item with an address-only location, and a
// Note item carrying a checklist (the packing-list shape). This object is also the
// fixture the prompt embeds, so its validity is what the unit test pins down.
const EXAMPLE_TRIP: Trip = {
  id: '7c3a9b1e-2d4f-4a6b-8c0d-1e2f3a4b5c6d',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  title: 'Big Sur Weekend',
  startDate: '2026-08-14',
  endDate: '2026-08-15',
  days: [
    {
      id: 'a1b2c3d4-0001-4a6b-8c0d-1e2f3a4b5c6d',
      date: '2026-08-14',
      items: [
        {
          id: 'a1b2c3d4-0002-4a6b-8c0d-1e2f3a4b5c6d',
          name: 'Pack the car',
          category: 'note',
          notes: 'Trip-wide reminders default to day 1.',
          checklist: [
            { id: 'a1b2c3d4-0003-4a6b-8c0d-1e2f3a4b5c6d', label: 'Hiking boots', checked: false },
            { id: 'a1b2c3d4-0004-4a6b-8c0d-1e2f3a4b5c6d', label: 'Sunscreen', checked: false },
          ],
        },
        {
          id: 'a1b2c3d4-0005-4a6b-8c0d-1e2f3a4b5c6d',
          name: 'Bixby Creek Bridge',
          category: 'location',
          time: '11:30',
          location: { address: 'Bixby Creek Bridge, Monterey County, CA' },
        },
        {
          id: 'a1b2c3d4-0006-4a6b-8c0d-1e2f3a4b5c6d',
          name: 'Check in at Big Sur Lodge',
          category: 'stay',
          time: '16:00',
          location: { address: '47225 CA-1, Big Sur, CA 93920' },
        },
      ],
    },
    {
      id: 'a1b2c3d4-0007-4a6b-8c0d-1e2f3a4b5c6d',
      date: '2026-08-15',
      items: [
        {
          id: 'a1b2c3d4-0008-4a6b-8c0d-1e2f3a4b5c6d',
          name: 'McWay Falls overlook',
          category: 'activity',
          time: '09:00',
          location: { address: 'McWay Falls, Big Sur, CA' },
        },
      ],
    },
  ],
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
};

/** The worked example, pretty-printed exactly as it is embedded in the prompt. */
export const SCHEMA_PROMPT_EXAMPLE_JSON = serializeTrip(EXAMPLE_TRIP);

/**
 * Build the Schema Prompt text to place on the clipboard. Pure: no I/O, no
 * network. The output is deterministic so it can be diffed and tested.
 */
export function buildSchemaPrompt(): string {
  return `You convert a free-text trip plan into a single JSON file for the "On the Road" travel app. Read the trip description at the bottom and output ONE JSON object that matches the schema below. Output JSON only — no Markdown fences, no commentary before or after.

SCHEMA (every field name and type must match exactly):

- id: string — a random UUID (e.g. "${EXAMPLE_TRIP.id}").
- schemaVersion: the number ${CURRENT_SCHEMA_VERSION} exactly (not a string).
- title: string — a short trip title.
- startDate, endDate: "YYYY-MM-DD" — the inclusive first and last calendar dates of the trip. If the description gives no dates, infer the most plausible ones from the text (trip length, day count, season). If there is nothing to go on, default to a one-day trip starting next Saturday. Always emit concrete dates — never a placeholder and never a question; the dates can be adjusted in the app afterwards.
- days: an array with ONE entry per calendar date from startDate through endDate inclusive (no gaps). Each day is:
    - id: string — a random UUID.
    - date: "YYYY-MM-DD" — that day's date.
    - items: an array of entries on that day (may be empty). Each item is:
        - id: string — a random UUID.
        - name: string — required, non-empty.
        - category: one of "activity", "location", "stay", "meal", "note". Use "stay" for lodging, "meal" for food, "location" for a place to see, "activity" for things to do, "note" for reminders. Defaults to "activity" if unsure.
        - time: optional "HH:mm" (24-hour). Omit if there is no specific time.
        - location: optional object { "address": string }. ADDRESS TEXT ONLY — never latitude/longitude. Omit if there is no place.
        - notes: optional string.
        - checklist: optional array of { "id": random UUID, "label": string, "checked": false }. Use this for packing lists and to-do lists.
- createdAt, updatedAt: ISO-8601 timestamps (e.g. "${EXAMPLE_TRIP.createdAt}"). Use the current date-time; the same value for both is fine.

RULES:
- Generate a fresh random UUID for every id (trip, each day, each item, each checklist entry). Never reuse an id.
- Never drop content. Anything with no clear day — a packing list, a budget, "book the ferry" — goes on the most plausible day (a booking reminder on the day it concerns; trip-wide content on day 1) as a "note" item, with packing/to-do lists becoming a checklist.
- Capture places as address text only. Do not include coordinates.

EXAMPLE (a valid output for a two-day trip):

${SCHEMA_PROMPT_EXAMPLE_JSON}

Now convert the following trip description into one JSON object in exactly this format:

<paste your trip description here>`;
}
