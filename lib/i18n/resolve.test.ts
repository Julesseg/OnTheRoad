import { describe, it, expect } from 'vitest';
import { resolveLocale } from './resolve';

describe('resolveLocale', () => {
  it('picks French when the top preferred language is fr', () => {
    expect(resolveLocale(['fr-FR', 'en-US'])).toBe('fr');
  });

  it('resolves any French region (fr-CA) to fr by language code', () => {
    expect(resolveLocale(['fr-CA'])).toBe('fr');
  });

  it('picks English when the top preferred language is en', () => {
    expect(resolveLocale(['en-GB', 'fr-FR'])).toBe('en');
  });

  it('falls back to English for an unsupported system language', () => {
    expect(resolveLocale(['es-ES', 'de-DE'])).toBe('en');
  });

  it('falls back to English when the list is empty', () => {
    expect(resolveLocale([])).toBe('en');
  });

  it('honours order: the first supported language wins over a later one', () => {
    expect(resolveLocale(['de-DE', 'fr-FR', 'en-US'])).toBe('fr');
  });
});
