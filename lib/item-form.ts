import { z } from 'zod';
import { parseLatLng } from './coords';
import type { Item } from './schema';

export type ItemType = Item['type'];

/** Flat string-valued shape backing the editor form; per-type schema validates the relevant subset. */
export interface ItemFormValues {
  name: string;
  text: string;
  address: string;
  coords: string;
  time: string;
  checkIn: string;
  checkOut: string;
  confirmationNumber: string;
  duration: string;
  notes: string;
}

export function emptyForm(): ItemFormValues {
  return {
    name: '',
    text: '',
    address: '',
    coords: '',
    time: '',
    checkIn: '',
    checkOut: '',
    confirmationNumber: '',
    duration: '',
    notes: '',
  };
}

/** Parse a free-typed "lat, lng" pair; delegates to the shared coords parser. */
export const parseCoords = parseLatLng;

/**
 * Split a stored duration (whole minutes, held as the flat form string) into the
 * hours and minutes the wheel picker selects on. Returns `null` when unset so the
 * editor can show its "not set" affordance. An odd, non-5-minute legacy value
 * (e.g. `7`) is preserved faithfully — the wheel only snaps to 5-minute steps once
 * the traveller actually edits it.
 */
export function durationToHm(duration: string): { hours: number; minutes: number } | null {
  const trimmed = duration.trim();
  if (trimmed === '' || !/^\d+$/.test(trimmed)) return null;
  const total = Number(trimmed);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** Recombine wheel hours + minutes back into total whole minutes (the flat form string). */
export function hmToDuration(hours: number, minutes: number): string {
  return String(hours * 60 + minutes);
}

const required = (msg = 'Required') => z.string().trim().min(1, msg);
const optionalTime = z
  .string()
  .refine((s) => s === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(s), 'Use HH:mm (24-hour)');
const optionalCoords = z
  .string()
  .refine((s) => s === '' || parseCoords(s) !== null, 'Use "lat, lng" (e.g. 47.6, -122.3)');
const optionalDuration = z
  .string()
  .refine((s) => s === '' || (/^\d+$/.test(s) && Number(s) > 0), 'Whole minutes greater than 0');

/**
 * Per-type zod schema over the flat form strings, for use as a react-hook-form resolver.
 * Every field is present (unconstrained ones pass through as plain strings) so the schema's
 * output is exactly `ItemFormValues` — that lets the resolver stay typed without a cast.
 */
export function itemFormSchema(type: ItemType): z.ZodType<ItemFormValues, ItemFormValues> {
  const base = {
    name: z.string(),
    text: z.string(),
    address: z.string(),
    coords: z.string(),
    time: z.string(),
    checkIn: z.string(),
    checkOut: z.string(),
    confirmationNumber: z.string(),
    duration: z.string(),
    notes: z.string(),
  };
  switch (type) {
    case 'location':
      return z.object({ ...base, name: required(), time: optionalTime, coords: optionalCoords });
    case 'activity':
      return z.object({ ...base, name: required(), time: optionalTime, duration: optionalDuration });
    case 'accommodation':
      return z.object({ ...base, name: required(), checkIn: optionalTime, checkOut: optionalTime });
    case 'note':
      return z.object({ ...base, text: required() });
  }
}

function trimToUndefined(s: string): string | undefined {
  const t = s.trim();
  return t === '' ? undefined : t;
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/** Populate the flat form shape from an existing item, for the edit path. */
export function itemToForm(item: Item): ItemFormValues {
  const base = emptyForm();
  switch (item.type) {
    case 'location':
      return {
        ...base,
        name: item.name,
        address: item.address ?? '',
        coords: item.lat != null && item.lng != null ? `${item.lat}, ${item.lng}` : '',
        time: item.time ?? '',
        notes: item.notes ?? '',
      };
    case 'accommodation':
      return {
        ...base,
        name: item.name,
        address: item.address ?? '',
        checkIn: item.checkIn ?? '',
        checkOut: item.checkOut ?? '',
        confirmationNumber: item.confirmationNumber ?? '',
        notes: item.notes ?? '',
      };
    case 'activity':
      return {
        ...base,
        name: item.name,
        time: item.time ?? '',
        duration: item.duration != null ? String(item.duration) : '',
        notes: item.notes ?? '',
      };
    case 'note':
      return { ...base, text: item.text };
  }
}

/**
 * Convert validated form strings into a domain Item. Assumes the per-type schema already passed.
 * Pass `original` on the edit path so fields the form doesn't surface (currently `attachments`)
 * are carried over instead of being silently dropped on save.
 */
export function formToItem(type: ItemType, v: ItemFormValues, id: string, original?: Item): Item {
  const carried = original?.attachments ? { attachments: original.attachments } : {};
  switch (type) {
    case 'location': {
      const c = parseCoords(v.coords);
      return omitUndefined({
        type: 'location',
        id,
        name: v.name.trim(),
        address: trimToUndefined(v.address),
        lat: c?.lat,
        lng: c?.lng,
        time: trimToUndefined(v.time),
        notes: trimToUndefined(v.notes),
        ...carried,
      }) as Item;
    }
    case 'activity':
      return omitUndefined({
        type: 'activity',
        id,
        name: v.name.trim(),
        time: trimToUndefined(v.time),
        duration: v.duration.trim() === '' ? undefined : Number(v.duration),
        notes: trimToUndefined(v.notes),
        ...carried,
      }) as Item;
    case 'accommodation':
      return omitUndefined({
        type: 'accommodation',
        id,
        name: v.name.trim(),
        address: trimToUndefined(v.address),
        checkIn: trimToUndefined(v.checkIn),
        checkOut: trimToUndefined(v.checkOut),
        confirmationNumber: trimToUndefined(v.confirmationNumber),
        notes: trimToUndefined(v.notes),
        ...carried,
      }) as Item;
    case 'note':
      return { type: 'note', id, text: v.text.trim(), ...carried };
  }
}
