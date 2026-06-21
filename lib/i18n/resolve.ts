export type Locale = 'en' | 'fr';

/** English is the base locale and the fallback for any unsupported language. */
export const BASE_LOCALE: Locale = 'en';

/**
 * Resolve the UI locale from the device's ordered preferred-languages list
 * (e.g. `['fr-CA', 'en-US']`). Matches on the **language code** only, so
 * `fr-CA` and `fr-FR` both resolve to French, and falls back to English for
 * any language we don't support.
 */
export function resolveLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const code = tag.toLowerCase().split('-')[0];
    if (code === 'fr') return 'fr';
    if (code === 'en') return 'en';
  }
  return BASE_LOCALE;
}
