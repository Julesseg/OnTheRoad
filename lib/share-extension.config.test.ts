import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import plist from '@expo/plist';
import { describe, expect, it } from 'vitest';

import { SHARE_ACTION_TITLE, buildShareExtensionInfoPlist } from './share-extension';

// The committed native artifacts under targets/share are what @bacons/apple-targets
// links into the regenerated Xcode project on `expo prebuild`. These tests pin them
// to the tested builder so the share-sheet activation rule and action title can
// never silently drift from lib/share-extension.ts.
const targetDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../targets/share');

describe('targets/share/Info.plist', () => {
  it('serializes exactly the tested Info.plist builder', () => {
    const xml = readFileSync(path.join(targetDir, 'Info.plist'), 'utf8');
    expect(plist.parse(xml)).toEqual(buildShareExtensionInfoPlist());
  });
});

describe('targets/share/expo-target.config.js', () => {
  it('declares a share-extension target titled "Add to On the Road"', () => {
    const config = createRequire(import.meta.url)('../targets/share/expo-target.config.js');
    expect(config.type).toBe('share');
    expect(config.displayName).toBe(SHARE_ACTION_TITLE);
    // A native handoff shim, not a React Native extension (ADR-0008).
    expect(config.exportJs).toBe(false);
  });
});
