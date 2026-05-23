import { z } from 'zod';
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

/** Parse a free-typed "lat, lng" pair. Returns null for anything out of geographic range or malformed. */
export function parseCoords(input: string): { lat: number; lng: number } | null {
  const m = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
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

/** Per-type zod schema over the flat form strings, for use as a react-hook-form resolver. */
export function itemFormSchema(type: ItemType) {
  switch (type) {
    case 'location':
      return z.object({ name: required(), time: optionalTime, coords: optionalCoords });
    case 'activity':
      return z.object({ name: required(), time: optionalTime, duration: optionalDuration });
    case 'accommodation':
      return z.object({ name: required(), checkIn: optionalTime, checkOut: optionalTime });
    case 'note':
      return z.object({ text: required() });
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

/** Convert validated form strings into a domain Item. Assumes the per-type schema already passed. */
export function formToItem(type: ItemType, v: ItemFormValues, id: string): Item {
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
      }) as Item;
    case 'note':
      return { type: 'note', id, text: v.text.trim() };
  }
}
