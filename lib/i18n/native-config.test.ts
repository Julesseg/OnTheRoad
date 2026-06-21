import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// The native iOS layer is localized through static config (ADR-0015): Expo's
// top-level `locales` map translates the permission usage strings, and
// CFBundleLocalizations makes iOS report French support so native pickers and
// system dialogs render in French on a French device. These pin that config so
// it can't silently drift.
const appJson = createRequire(import.meta.url)('../../app.json');
const requireLocale = createRequire(import.meta.url);

describe('app.json native localization', () => {
  it('lists English and French in CFBundleLocalizations', () => {
    const langs = appJson.expo.ios.infoPlist?.CFBundleLocalizations;
    expect(langs).toEqual(expect.arrayContaining(['en', 'fr']));
  });

  it('maps both locales to their native strings files', () => {
    expect(appJson.expo.locales).toMatchObject({
      en: expect.any(String),
      fr: expect.any(String),
    });
  });

  it('translates the two permission usage strings into French', () => {
    const fr = requireLocale(`../../${appJson.expo.locales.fr}`);
    expect(fr.NSLocationWhenInUseUsageDescription).toMatch(/position/i);
    expect(fr.NSPhotoLibraryUsageDescription).toMatch(/couverture|photo/i);
  });

  it('keeps the brand name "On the Road" untranslated', () => {
    const fr = requireLocale(`../../${appJson.expo.locales.fr}`);
    // No localized display name — the brand stays English everywhere.
    expect(fr.CFBundleDisplayName).toBeUndefined();
    expect(appJson.expo.name).toBe('on-the-road');
  });
});
