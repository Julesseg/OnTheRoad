import { getLocales } from 'expo-localization';
import { resolveLocale, type Locale } from './resolve';
import { translate, type Params, type Plural } from './translate';
import { en, type Messages } from './dictionaries/en';
import { fr } from './dictionaries/fr';

export type { Locale } from './resolve';

/**
 * The locale the UI renders in, resolved **once at startup** from the device's
 * ordered preferred-languages list. iOS relaunches the app when the system
 * language changes, so a running app never observes a mid-session switch and we
 * deliberately don't subscribe to live changes. There is no in-app override.
 */
export const locale: Locale = resolveLocale(getLocales().map((l) => l.languageTag));

const DICTS: Record<Locale, typeof en> = { en, fr };

// Dot-pathed keys to every leaf (string or plural) in the dictionary, so a typo
// or stale key is a compile error at the call site.
type Join<K, P> = K extends string
  ? P extends ''
    ? K
    : P extends string
      ? `${K}.${P}`
      : never
  : never;

type Leaves<T> = T extends string | Plural
  ? ''
  : { [K in keyof T]-?: Join<K & string, Leaves<T[K]>> }[keyof T];

export type MessageKey = Leaves<Messages>;

/**
 * Look up UI chrome by semantic, dot-pathed `key`, interpolating `{param}`
 * placeholders and selecting plurals from `params.count`. Defaults to the
 * resolved {@link locale}; pass an explicit `loc` to render either language
 * (tests, or a surface that needs both). English is always the fallback for a
 * value the active locale is missing — never the raw key.
 */
export function t(key: MessageKey, params?: Params, loc: Locale = locale): string {
  return translate(en, DICTS[loc], loc, key, params);
}
