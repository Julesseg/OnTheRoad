import type { Locale } from './resolve';
import { pluralCategory } from './plural';

/** A pluralised leaf: the singular and plural forms for the active count. */
export type Plural = { one: string; other: string };

export type Dict = { [key: string]: string | Plural | Dict };

export type Params = Record<string, string | number>;

function isPlural(value: unknown): value is Plural {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Plural).one === 'string' &&
    typeof (value as Plural).other === 'string'
  );
}

/** Walk a dot-path (`a.b.c`) into a nested dictionary, or undefined if absent. */
function lookup(dict: Dict, key: string): string | Plural | undefined {
  let node: string | Plural | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || isPlural(node)) return undefined;
    node = node[part];
    if (node === undefined) return undefined;
  }
  return typeof node === 'object' && !isPlural(node) ? undefined : node;
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/**
 * Resolve a nested, dot-pathed `key` to a localized string. `source` is the
 * English source of truth and the fallback; `target` is the active locale's
 * dictionary. A missing/empty value in `target` falls back to the `source`
 * string — never the raw key. `{param}` placeholders are interpolated, and a
 * pluralised leaf picks its form from `params.count` using the locale's rule.
 */
export function translate(
  source: Dict,
  target: Dict,
  locale: Locale,
  key: string,
  params?: Params,
): string {
  const picked = lookup(target, key) ?? lookup(source, key);
  if (picked === undefined) return key;

  if (isPlural(picked)) {
    const count = typeof params?.count === 'number' ? params.count : 0;
    return interpolate(picked[pluralCategory(locale, count)], params);
  }
  return interpolate(picked, params);
}
