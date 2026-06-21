import { describe, it, expect } from 'vitest';
import { translate, type Dict } from './translate';

const en = {
  trips: { title: 'Trips', empty: 'No trips yet' },
  greeting: 'Hello {name}',
  countdown: {
    before: { one: 'in {count} day', other: 'in {count} days' },
  },
} satisfies Dict;

const fr = {
  trips: { title: 'Voyages', empty: 'Aucun voyage' },
  greeting: 'Bonjour {name}',
  countdown: {
    before: { one: 'dans {count} jour', other: 'dans {count} jours' },
  },
} satisfies Dict;

describe('translate', () => {
  it('looks up a nested key in the active locale', () => {
    expect(translate(en, fr, 'fr', 'trips.title')).toBe('Voyages');
    expect(translate(en, en, 'en', 'trips.title')).toBe('Trips');
  });

  it('interpolates {param} placeholders', () => {
    expect(translate(en, fr, 'fr', 'greeting', { name: 'Jules' })).toBe('Bonjour Jules');
  });

  it('selects the plural form by count using the locale rule', () => {
    // English: only 1 is singular.
    expect(translate(en, en, 'en', 'countdown.before', { count: 1 })).toBe('in 1 day');
    expect(translate(en, en, 'en', 'countdown.before', { count: 2 })).toBe('in 2 days');
    // French: 0 and 1 are singular.
    expect(translate(en, fr, 'fr', 'countdown.before', { count: 0 })).toBe('dans 0 jour');
    expect(translate(en, fr, 'fr', 'countdown.before', { count: 1 })).toBe('dans 1 jour');
    expect(translate(en, fr, 'fr', 'countdown.before', { count: 3 })).toBe('dans 3 jours');
  });

  it('falls back to the English string when the French value is missing', () => {
    // A French dict whose `trips.title` is absent at runtime still resolves to
    // the English string, never the raw key.
    const partialFr = { trips: { empty: 'Aucun voyage' } } as unknown as Dict;
    expect(translate(en, partialFr, 'fr', 'trips.title')).toBe('Trips');
  });

  it('never returns the raw key for a present key in either locale', () => {
    expect(translate(en, fr, 'fr', 'trips.empty')).toBe('Aucun voyage');
  });
});
