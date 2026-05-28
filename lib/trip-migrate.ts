import { CURRENT_SCHEMA_VERSION } from './schema';

/**
 * Upgrade a persisted trip object to the current schema version before it is
 * validated. v1 trips predate the per-trip wallpaper (issue #15); they upgrade
 * to v2 with no wallpaper. Non-objects and already-current objects pass through
 * untouched, leaving the schema parser to accept or reject them.
 */
export function migrateTripData(data: unknown): unknown {
  if (data === null || typeof data !== 'object') return data;
  const obj = data as Record<string, unknown>;
  if (obj.schemaVersion === 1) {
    return { ...obj, schemaVersion: CURRENT_SCHEMA_VERSION };
  }
  return data;
}
