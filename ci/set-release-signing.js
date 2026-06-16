#!/usr/bin/env node
'use strict';

// Pins per-target manual code signing on the app's Xcode project, run in CI
// right after `expo prebuild` (when both the main app and the Share Extension
// targets exist in the freshly regenerated project).
//
// Why this exists: the main app (com.julesseguin.ontheroad) and the Share
// Extension (com.julesseguin.ontheroad.share) are separate targets with
// separate explicit App IDs, each carrying the App Groups capability, so each
// needs its OWN Ad Hoc provisioning profile. `xcodebuild` build settings passed
// on the command line are global — one PROVISIONING_PROFILE_SPECIFIER can't sign
// two different bundle ids — so we pin the profile per target here instead.
//
// Matching is by PRODUCT_BUNDLE_IDENTIFIER (not target name), which survives the
// prebuild regenerating the project. DEVELOPMENT_TEAM is taken from the
// APPLE_TEAM_ID env var when present so it stays out of source control.

const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

const PROJECT_PATH = path.join(
  __dirname,
  '..',
  'ios',
  'ontheroad.xcodeproj',
  'project.pbxproj'
);

// bundle identifier -> Ad Hoc provisioning profile name (Apple Developer portal).
const PROFILE_BY_BUNDLE_ID = {
  'com.julesseguin.ontheroad': 'OnTheRoad Ad Hoc',
  'com.julesseguin.ontheroad.share': 'OnTheRoad Share Ad Hoc',
};

const team = process.env.APPLE_TEAM_ID;

const project = xcode.project(PROJECT_PATH);
project.parseSync();

const unquote = (value) => String(value).replace(/^"|"$/g, '');
const configs = project.pbxXCBuildConfigurationSection();

let pinned = 0;
for (const key of Object.keys(configs)) {
  const entry = configs[key];
  if (!entry || typeof entry !== 'object' || !entry.buildSettings) continue;

  const bundleId = unquote(entry.buildSettings.PRODUCT_BUNDLE_IDENTIFIER || '');
  const profile = PROFILE_BY_BUNDLE_ID[bundleId];
  if (!profile) continue;

  entry.buildSettings.CODE_SIGN_STYLE = 'Manual';
  entry.buildSettings.PROVISIONING_PROFILE_SPECIFIER = `"${profile}"`;
  if (team) entry.buildSettings.DEVELOPMENT_TEAM = team;
  pinned += 1;
}

// Both targets have Debug + Release configurations, so a healthy run pins at
// least two (Release) configurations. Zero means the bundle ids drifted and the
// archive would fall back to the wrong/automatic profile — fail loudly instead.
if (pinned === 0) {
  console.error(
    'set-release-signing: no build configurations matched ' +
      Object.keys(PROFILE_BY_BUNDLE_ID).join(', ') +
      ' — did the bundle identifiers change?'
  );
  process.exit(1);
}

fs.writeFileSync(PROJECT_PATH, project.writeSync());
console.log(`set-release-signing: pinned manual signing on ${pinned} build configuration(s).`);
