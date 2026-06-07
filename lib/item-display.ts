import type { Item } from './schema';
import { itemIdentity } from './item-identity';

export type ItemDisplay = {
  typeLabel: string;
  title: string;
  lines: string[];
};

export function formatItem(item: Item): ItemDisplay {
  const lines: string[] = [];
  if (item.location?.address) lines.push(item.location.address);
  if (item.time) lines.push(`At ${item.time}`);
  if (item.notes) lines.push(item.notes);
  return {
    typeLabel: itemIdentity(item.category).label,
    title: item.name,
    lines,
  };
}

/** The single comparable time an item happens at. */
export function itemTime(item: Item): string | undefined {
  return item.time;
}

/** Items ordered chronologically by their time; untimed items follow in their
 * original relative order. Returns a new array — the input is not mutated. */
export function sortItemsByTime(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const ta = itemTime(a);
    const tb = itemTime(b);
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return ta.localeCompare(tb);
  });
}

export type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'url'; value: string; href: string }
  | { kind: 'phone'; value: string; href: string };

const TOKEN_RE = /(?<url>https?:\/\/[^\s]+)|(?<phone>(?<!\d)(?!\d{4}-\d{2}-\d{2})\+?\d[\d().-]{5,}\d)/g;

export function linkify(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const start = match.index;
    const value = match[0];
    if (start > last) segments.push({ kind: 'text', value: text.slice(last, start) });
    if (match.groups?.url) {
      segments.push({ kind: 'url', value, href: value });
    } else {
      segments.push({ kind: 'phone', value, href: `tel:${value.replace(/\D/g, '')}` });
    }
    last = start + value.length;
  }
  if (last < text.length || segments.length === 0) {
    segments.push({ kind: 'text', value: text.slice(last) });
  }
  return segments;
}
