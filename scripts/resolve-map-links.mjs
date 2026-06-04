// Resolves the Google Maps short links stored in each item's notes into exact
// coordinates and writes lat/lng (and the resolved place URL) back into the trip.
//
// Requires network egress to maps.app.goo.gl / google.com — run it in a session
// whose environment network policy allows outbound Google access. From the repo
// root:  node scripts/resolve-map-links.mjs
//
// It reuses the app's own parsing grammar (lib/coords.ts) so the result matches
// what the app would extract on-device.

import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../data/trips/vanlife-slovenia.json', import.meta.url);
const trip = JSON.parse(readFileSync(path, 'utf8'));

// --- coordinate parsing, mirrored from lib/coords.ts (most precise first) ---
const URL_PATTERNS = [
  /[?&](?:ll|q|daddr)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
];
const inRange = (lat, lng) =>
  lat < -90 || lat > 90 || lng < -180 || lng > 180 ? null : { lat, lng };
function parseMapsUrl(input) {
  if (typeof input !== 'string') return null;
  for (const p of URL_PATTERNS) {
    const m = input.match(p);
    if (m) {
      const c = inRange(Number(m[1]), Number(m[2]));
      if (c) return c;
    }
  }
  return null;
}
async function resolveMapsUrl(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      },
    });
    return { coords: parseMapsUrl(res.url) ?? parseMapsUrl(await res.text()), finalUrl: res.url };
  } catch (e) {
    return { coords: null, finalUrl: null, error: String(e) };
  }
}

const URL_RE = /https:\/\/maps\.app\.goo\.gl\/\S+/;

let resolved = 0;
let failed = 0;
for (const day of trip.days) {
  for (const item of day.items) {
    if (item.type !== 'location') continue; // only location items hold lat/lng
    const m = item.notes?.match(URL_RE);
    if (!m) continue;
    const { coords, finalUrl, error } = await resolveMapsUrl(m[0]);
    if (coords) {
      item.lat = Number(coords.lat.toFixed(6));
      item.lng = Number(coords.lng.toFixed(6));
      resolved++;
      console.log(`✓ ${day.date} ${item.name} → ${item.lat},${item.lng}`);
    } else {
      failed++;
      console.warn(`✗ ${day.date} ${item.name} (${error ?? finalUrl ?? 'no coords'})`);
    }
  }
}

if (resolved > 0) {
  trip.updatedAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify(trip, null, 2) + '\n');
}
console.log(`\nresolved ${resolved}, failed ${failed}`);
