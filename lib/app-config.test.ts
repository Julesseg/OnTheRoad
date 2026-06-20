import { createRequire } from 'node:module';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// app.config.js extends the static app.json with values that must stay out of
// version control — the Apple Team ID (iOS signing) and, for the Android port,
// the Google Maps SDK key the GoogleMaps.View renderer needs. Both are read from
// the environment at evaluation time (see .env.example), so these tests drive the
// config function with a known env and assert the wiring.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appJson = require('../app.json') as any;
const loadConfig = () => require('../app.config.js') as () => Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('app.json android target', () => {
  it('publishes under the real application id, not the Expo default', () => {
    expect(appJson.expo.android.package).toBe('com.julesseguin.ontheroad');
    expect(appJson.expo.android.package).not.toContain('anonymous');
  });
});

describe('app.config.js', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.APPLE_TEAM_ID = 'TEAMID123';
    process.env.GOOGLE_MAPS_API_KEY = 'maps-key-xyz';
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it('keeps wiring the Apple Team ID from the environment', () => {
    expect(loadConfig()().ios.appleTeamId).toBe('TEAMID123');
  });

  it('wires the Google Maps Android key from the environment for GoogleMaps.View', () => {
    expect(loadConfig()().android.config.googleMaps.apiKey).toBe('maps-key-xyz');
  });

  it('preserves the static android config (package, adaptive icon) while injecting the key', () => {
    const android = loadConfig()().android;
    expect(android.package).toBe('com.julesseguin.ontheroad');
    expect(android.adaptiveIcon).toBeDefined();
  });
});
