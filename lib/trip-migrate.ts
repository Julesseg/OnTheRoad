import { CURRENT_SCHEMA_VERSION } from './schema';

function migrateV2Item(item: Record<string, unknown>): Record<string, unknown> {
  const type = item.type as string;

  if (type === 'location') {
    const location: Record<string, unknown> = {};
    if (item.address != null) location.address = item.address;
    if (item.lat != null) location.lat = item.lat;
    if (item.lng != null) location.lng = item.lng;
    return {
      id: item.id,
      name: item.name,
      category: 'location',
      ...(item.time != null ? { time: item.time } : {}),
      ...(Object.keys(location).length > 0 ? { location } : {}),
      ...(item.notes != null ? { notes: item.notes } : {}),
    };
  }

  if (type === 'accommodation') {
    const noteParts: string[] = [];
    if (item.checkOut != null) noteParts.push(`Check-out: ${item.checkOut}`);
    if (item.confirmationNumber != null) noteParts.push(`Confirmation: ${item.confirmationNumber}`);
    if (item.notes != null) noteParts.push(item.notes as string);
    const notes = noteParts.join('\n') || undefined;
    const location: Record<string, unknown> = {};
    if (item.address != null) location.address = item.address;
    return {
      id: item.id,
      name: item.name,
      category: 'stay',
      ...(item.checkIn != null ? { time: item.checkIn } : {}),
      ...(Object.keys(location).length > 0 ? { location } : {}),
      ...(notes != null ? { notes } : {}),
    };
  }

  if (type === 'activity') {
    const noteParts: string[] = [];
    if (item.duration != null) noteParts.push(`Duration: ${item.duration} min`);
    if (item.notes != null) noteParts.push(item.notes as string);
    const notes = noteParts.join('\n') || undefined;
    return {
      id: item.id,
      name: item.name,
      category: 'activity',
      ...(item.time != null ? { time: item.time } : {}),
      ...(notes != null ? { notes } : {}),
    };
  }

  if (type === 'note') {
    const text = (item.text as string) ?? '';
    const lines = text.split('\n');
    const firstLine = lines[0].trim().slice(0, 80);
    const restIsMore = text.trim() !== firstLine;
    return {
      id: item.id,
      name: firstLine || 'Note',
      category: 'note',
      ...(restIsMore ? { notes: text } : {}),
    };
  }

  // Unknown type: pass through with category defaulting to activity
  return { ...item, category: item.category ?? 'activity' };
}

function migrateItems(days: unknown[]): unknown[] {
  return days.map((day) => {
    if (day === null || typeof day !== 'object') return day;
    const d = day as Record<string, unknown>;
    if (!Array.isArray(d.items)) return d;
    return {
      ...d,
      items: d.items.map((item) => {
        if (item === null || typeof item !== 'object') return item;
        return migrateV2Item(item as Record<string, unknown>);
      }),
    };
  });
}

/**
 * Upgrade a persisted trip object to the current schema version before it is
 * validated. v1/v2 trips both use the four-type discriminated union; v3 uses
 * the unified Item with category. v1 gains no wallpaper on the way up.
 * Non-objects and already-current objects pass through untouched.
 */
export function migrateTripData(data: unknown): unknown {
  if (data === null || typeof data !== 'object') return data;
  const obj = data as Record<string, unknown>;

  if (obj.schemaVersion === 1 || obj.schemaVersion === 2) {
    const days = Array.isArray(obj.days) ? migrateItems(obj.days) : obj.days;
    return { ...obj, schemaVersion: CURRENT_SCHEMA_VERSION, days };
  }

  return data;
}
