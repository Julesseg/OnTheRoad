import type { Item } from './schema';

export type ItemDisplay = {
  typeLabel: string;
  title: string;
  lines: string[];
};

export function formatItem(item: Item): ItemDisplay {
  switch (item.type) {
    case 'location': {
      const lines: string[] = [];
      if (item.address) lines.push(item.address);
      if (item.time) lines.push(`At ${item.time}`);
      if (item.notes) lines.push(item.notes);
      return { typeLabel: 'Location', title: item.name, lines };
    }
    case 'accommodation': {
      const lines: string[] = [];
      if (item.address) lines.push(item.address);
      if (item.checkIn) lines.push(`Check-in ${item.checkIn}`);
      if (item.checkOut) lines.push(`Check-out ${item.checkOut}`);
      if (item.confirmationNumber) lines.push(`Confirmation ${item.confirmationNumber}`);
      if (item.notes) lines.push(item.notes);
      return { typeLabel: 'Accommodation', title: item.name, lines };
    }
    case 'activity': {
      const lines: string[] = [];
      if (item.time) lines.push(`At ${item.time}`);
      if (item.duration != null) lines.push(`${item.duration} min`);
      if (item.notes) lines.push(item.notes);
      return { typeLabel: 'Activity', title: item.name, lines };
    }
    case 'note':
      return { typeLabel: 'Note', title: 'Note', lines: [item.text] };
  }
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
