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
 * Convert validated form strings into a domain Item. Pass `original` on the edit
 * path so fields the form doesn't surface (location, checklist) are carried over.
 */
export function formToItem(v: ItemFormValues, id: string, original?: Item): Item {
  return omitUndefined({
    id,
    name: v.name.trim(),
    category: v.category,
    time: trimToUndefined(v.time),
    notes: trimToUndefined(v.notes),
    ...(original?.location ? { location: original.location } : {}),
    ...(original?.checklist ? { checklist: original.checklist } : {}),
  }) as Item;
}
