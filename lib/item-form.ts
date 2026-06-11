import { z } from 'zod';
import type { Item, ItemCategory } from './schema';
import { ItemCategorySchema } from './schema';

export interface ItemFormValues {
  name: string;
  category: ItemCategory;
  time: string;
  notes: string;
}

export function emptyForm(): ItemFormValues {
  return { name: '', category: 'activity', time: '', notes: '' };
}

export function itemToForm(item: Item): ItemFormValues {
  return {
    name: item.name,
    category: item.category,
    time: item.time ?? '',
    notes: item.notes ?? '',
  };
}

const required = (msg = 'Required') => z.string().trim().min(1, msg);
const optionalTime = z
  .string()
  .refine((s) => s === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(s), 'Use HH:mm (24-hour)');

export function itemFormSchema() {
  return z.object({
    name: required(),
    category: ItemCategorySchema,
    time: optionalTime,
    notes: z.string(),
  });
}

function trimToUndefined(s: string): string | undefined {
  const t = s.trim();
  return t === '' ? undefined : t;
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Convert validated form strings into a domain Item.
 *
 * `location`:
 *   undefined → carry from `original` (name/notes-only edit, location unchanged)
 *   null      → explicitly cleared
 *   object    → new/updated value set via the location picker
 *
 * `checklist`:
 *   undefined → carry from `original` (checklist untouched by this edit)
 *   []        → emptied — the field is dropped from the item
 *   array     → new/updated entries from the editor's Checklist section
 */
export function formToItem(
  v: ItemFormValues,
  id: string,
  original?: Item,
  location?: Item['location'] | null,
  checklist?: Item['checklist'],
): Item {
  const resolvedLocation =
    location === undefined ? original?.location : location === null ? undefined : location;
  const resolvedChecklist = checklist === undefined ? original?.checklist : checklist;
  return omitUndefined({
    id,
    name: v.name.trim(),
    category: v.category,
    time: trimToUndefined(v.time),
    notes: trimToUndefined(v.notes),
    ...(resolvedLocation ? { location: resolvedLocation } : {}),
    ...(resolvedChecklist?.length ? { checklist: resolvedChecklist } : {}),
  }) as Item;
}
