import type { ItemCategory, Item, Trip } from './schema';
import { type Coords, parseMapsUrl, resolveMapsUrl } from './coords';
import { searchPlaces } from './photon';
import { newId } from './id';
import type { PendingCapture } from './share-bridge';

/** Hosts whose links are Apple/Google Maps shares (CONTEXT.md → Share Capture). */
function isMapsLink(url: string): boolean {
  let host: string;
  let pathname: string;
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, '');
    pathname = u.pathname;
  } catch {
    return false;
  }
  if (host === 'maps.apple.com') return true;
  if (host === 'maps.app.goo.gl') return true;
  if (/^maps\.google\./.test(host)) return true;
  // Legacy Google short link, still referenced by coords.ts (`resolveMapsUrl`).
  if (host === 'goo.gl' && pathname.startsWith('/maps')) return true;
  // `google.<tld>/maps`, capping the labels after `google.` to a 1–2 part TLD so a
  // spoofed `google.com.attacker.net` can't slip through (ccTLDs like `co.uk` stay valid).
  if (/(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host) && pathname.startsWith('/maps')) {
    return true;
  }
  return false;
}

/** The shared payload carried by an `ontheroad://share?url=…&text=…` deep link. */
export interface SharePayload {
  url?: string;
  text?: string;
}

/** The draft Item parts a classified payload yields, before it gets an id/day. */
export interface ShareDraft {
  name: string;
  category: ItemCategory;
  notes?: string;
  location?: Item['location'];
}

function firstString(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Read the `url` and `text` a Share Capture deep link carries. Expo Router hands
 * query params through as `string | string[] | undefined`; we take the first
 * value, trim it, and drop anything empty so the classifier sees only real input.
 */
export function parseShareParams(
  params: Record<string, string | string[] | undefined>,
): SharePayload {
  const payload: SharePayload = {};
  const url = firstString(params.url);
  const text = firstString(params.text);
  if (url) payload.url = url;
  if (text) payload.text = text;
  return payload;
}

function firstLine(text: string): string {
  return text.split('\n')[0].trim();
}

/**
 * Matches an http(s) URL up to the next whitespace, but never ending on the
 * sentence punctuation an iOS share leaves clinging to a link in prose
 * (`See https://x.com.` → `https://x.com`) — a trailing `.`/`)` would dirty the
 * `notes` link and break the de-dup in {@link collectUrls} against the `url` param.
 */
const URL_PATTERN = /https?:\/\/[^\s]*[^\s.,;:!?)\]}]/g;

/**
 * Every URL the payload carries, in order and de-duplicated: the explicit `url`
 * param first, then any links embedded in the shared text. The first is the
 * primary the Item is classified from; the rest ride along in `notes` so one
 * share never fans out into more than one Item (CONTEXT.md → Share Capture).
 */
function collectUrls(payload: SharePayload): string[] {
  const urls: string[] = [];
  const add = (url: string) => {
    if (!urls.includes(url)) urls.push(url);
  };
  if (payload.url) add(payload.url);
  for (const url of payload.text?.match(URL_PATTERN) ?? []) add(url);
  return urls;
}

/**
 * The shared text with its URLs removed, so a link never leaks into the
 * name/address. Removing a mid-line link leaves the spaces that flanked it behind,
 * so runs of intra-line whitespace are collapsed (newlines kept intact, since the
 * maps branch splits name from address on them).
 */
function descriptiveText(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  return text.replace(URL_PATTERN, '').replace(/[^\S\n]+/g, ' ');
}

/**
 * Classify link-less shared text into a Note (CONTEXT.md → Share Capture, decision
 * T1): its first line is the name and the remaining lines are kept in `notes`. A
 * Note is never auto-geocoded — it carries no location, so the user switches it to
 * a Place and picks a location in the editor if they want one. Empty text still
 * yields a Note so a capture is never lost.
 */
function classifyNote(text: string | undefined): ShareDraft {
  if (!text) return { name: 'Shared note', category: 'note' };
  const [name, ...rest] = text.split('\n');
  const notes = rest.join('\n').trim();
  const draft: ShareDraft = { name: name.trim() || 'Shared note', category: 'note' };
  if (notes) draft.notes = notes;
  return draft;
}

/** A shared URL's host without a leading `www.`, or the raw URL if it won't parse. */
function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Non-empty, trimmed lines of the shared text — the place name then its address. */
function textLines(text: string | undefined): string[] {
  if (!text) return [];
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

/**
 * Classify a Maps share into a Place Item (CONTEXT.md → Share Capture). The name
 * is the text's first line (or the host) and the address the lines beneath it;
 * coordinates are parsed straight from the URL when it carries them (ADR-0007
 * layer 1, offline), while short links that only redirect to their coordinates
 * are resolved later by {@link resolveShareCoords}. {@link classifyShare} fills in
 * `notes` (the link, plus any others the share carried).
 */
function classifyMapsLink(url: string, text: string | undefined): ShareDraft {
  const lines = textLines(text);
  const [name, ...rest] = lines;
  const address = rest.length ? rest.join(', ') : undefined;
  const coords = parseMapsUrl(url);

  const location: NonNullable<Item['location']> = {};
  if (address) location.address = address;
  if (coords) {
    location.lat = coords.lat;
    location.lng = coords.lng;
  }

  const draft: ShareDraft = { name: name || urlHost(url), category: 'location' };
  if (address || coords) draft.location = location;
  return draft;
}

/**
 * Classify a non-maps link into an Activity (CONTEXT.md → Share Capture), naming
 * the Item from the shared text's first line, or the link's host when there is no
 * text. {@link classifyShare} fills in `notes` (the link, plus any others shared).
 */
function classifyGenericLink(url: string, text: string | undefined): ShareDraft {
  const fromText = text ? firstLine(text) : '';
  return { name: fromText || urlHost(url), category: 'activity' };
}

/**
 * Classify a shared payload into exactly one draft Item (CONTEXT.md → Share
 * Capture). The payload's first URL is the primary — an Apple/Google Maps link
 * becomes a Place ({@link classifyMapsLink}), any other URL an Activity — and any
 * remaining URLs ride along in `notes`, so one share is never more than one Item.
 * Link-less text becomes a Note ({@link classifyNote}), never auto-geocoded.
 */
export function classifyShare(payload: SharePayload): ShareDraft {
  const urls = collectUrls(payload);
  if (urls.length === 0) return classifyNote(payload.text);

  const [primary] = urls;
  const text = descriptiveText(payload.text);
  const draft = isMapsLink(primary)
    ? classifyMapsLink(primary, text)
    : classifyGenericLink(primary, text);
  draft.notes = urls.join('\n');
  return draft;
}

/** Geocode shared text to a single best-guess pin through the Photon service (ADR-0007 layer 3). */
async function photonGeocode(query: string): Promise<Coords | null> {
  const results = await searchPlaces(query);
  return results[0]?.coords ?? null;
}

export interface ResolveShareCoordsOptions {
  /** Injected for the redirect follow (ADR-0007 layer 2); defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injected for the geocode fallback (layer 3); defaults to a Photon lookup. */
  geocode?: (query: string) => Promise<Coords | null>;
}

/**
 * Resolve a Maps capture's coordinates over the network, in ADR-0007's layers:
 * parse the URL (layer 1, offline), else follow a short link's redirect and parse
 * the resolved URL (layer 2), else geocode the shared name/address through Photon
 * (layer 3). Returns null when every layer fails (offline, unparseable) so the
 * caller keeps the address-only Place — a capture is never lost. Returns null for
 * any payload that isn't a Maps link.
 */
export async function resolveShareCoords(
  payload: SharePayload,
  options: ResolveShareCoordsOptions = {},
): Promise<Coords | null> {
  const { fetchImpl = globalThis.fetch, geocode = photonGeocode } = options;
  if (!payload.url || !isMapsLink(payload.url)) return null;

  const fromUrl = await resolveMapsUrl(payload.url, fetchImpl);
  if (fromUrl) return fromUrl;

  const query = payload.text?.trim();
  if (!query) return null;
  try {
    return await geocode(query);
  } catch {
    return null;
  }
}

/**
 * The day a Share Capture lands on by default: today when the destination trip is
 * in progress, otherwise the trip's first day. A trip's first day is always its
 * `startDate` (days span startDate…endDate), so this needs only the trip's dates.
 */
export function defaultCaptureDate(
  trip: { startDate: string; endDate: string },
  today: string,
): string {
  if (trip.startDate <= today && today <= trip.endDate) return today;
  return trip.startDate;
}

/** A capture resolved into a concrete Item ready to drop onto a trip's day. */
export interface ProcessedCapture {
  tripId: string;
  dayId: string;
  item: Item;
}

export interface ProcessPendingCaptureOptions extends ResolveShareCoordsOptions {
  /** Injected so tests can assert a deterministic Item id; defaults to {@link newId}. */
  makeId?: () => string;
}

/**
 * Turn a {@link PendingCapture} the Share Extension queued into a concrete Item on
 * the picked trip/day, in the background — no editor (ADR-0008). This is the same
 * pipeline the editor runs, minus the human: {@link classifyShare} for the draft,
 * then {@link resolveShareCoords} when a Maps Place lacks an inline pin (the editor's
 * `needsResolve` gate), then the user's note kept above the captured links. The day
 * is the one the user picked in the extension, falling back to
 * {@link defaultCaptureDate} if that date no longer falls in the trip (its dates may
 * have changed since the capture). Returns null only if the trip has no days.
 */
export async function processPendingCapture(
  capture: PendingCapture,
  trip: Trip,
  today: string,
  options: ProcessPendingCaptureOptions = {},
): Promise<ProcessedCapture | null> {
  const { makeId = newId, ...resolveOptions } = options;

  const payload: SharePayload = {};
  if (capture.url) payload.url = capture.url;
  if (capture.text) payload.text = capture.text;

  const draft = classifyShare(payload);

  let location = draft.location;
  const hasPin = location?.lat != null;
  if (draft.category === 'location' && payload.url && !hasPin) {
    const coords = await resolveShareCoords(payload, resolveOptions);
    if (coords) location = { ...(location ?? {}), lat: coords.lat, lng: coords.lng };
  }

  const dayId =
    trip.days.find((d) => d.date === capture.date)?.id ??
    trip.days.find((d) => d.date === defaultCaptureDate(trip, today))?.id ??
    trip.days[0]?.id;
  if (!dayId) return null;

  const notes = [capture.note?.trim(), draft.notes].filter(Boolean).join('\n\n');

  // The user's confirmed title (prefilled from the shared content) wins over the
  // name the classifier derived; an empty/absent title leaves the classifier's.
  const title = capture.title?.trim();
  const item: Item = { id: makeId(), name: title || draft.name, category: draft.category };
  if (location && (location.address || location.lat != null)) item.location = location;
  if (notes) item.notes = notes;
  // The extension's time picker is optional; carry a well-formed HH:mm through.
  if (capture.time && /^\d{2}:\d{2}$/.test(capture.time)) item.time = capture.time;

  return { tripId: trip.id, dayId, item };
}
