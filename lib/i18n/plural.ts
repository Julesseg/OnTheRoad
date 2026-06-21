import type { Locale } from './resolve';

export type PluralCategory = 'one' | 'other';

/**
 * Pick the plural category for a count, by hand. English treats only **1** as
 * singular; French groups **0 and 1** as singular. These are the only two rules
 * the app needs, so they're spelled out here rather than pulled from Intl.
 */
export function pluralCategory(locale: Locale, count: number): PluralCategory {
  const n = Math.abs(count);
  if (locale === 'fr') return n <= 1 ? 'one' : 'other';
  return n === 1 ? 'one' : 'other';
}
