import type { Dict } from '../translate';

/**
 * The English dictionary — the **source of truth** for the app's UI chrome.
 * Every locale's dictionary is typed against this one (`fr: typeof en`), so a
 * missing or renamed key is a compile error. Only UI chrome lives here; trip
 * titles, item names, notes, and addresses are user content and are never keyed.
 */
export const en = {
  status: {
    inProgress: 'In progress',
    upcoming: 'Upcoming',
    past: 'Past',
  },
  unit: {
    day: { one: 'day', other: 'days' },
    week: { one: 'week', other: 'weeks' },
    month: { one: 'month', other: 'months' },
    year: { one: 'year', other: 'years' },
  },
  unitAbbr: {
    day: 'd',
    week: 'w',
    month: 'mo',
    year: 'y',
  },
  countdown: {
    now: 'Now',
    inProgress: 'In progress',
    before: 'in {value} {unit}',
    after: '{value} {unit} ago',
    startsIn: 'Starts in {value} {unit}',
    endedAgo: 'Ended {value} {unit} ago',
    compactBefore: 'in {abbr}',
    compactAfter: '{abbr} ago',
  },
  trips: {
    title: 'Trips',
    empty: 'No trips yet',
    pastSection: 'Past trips',
    new: 'New Trip',
    import: 'Import Trip',
    addTrip: 'Add trip',
    settings: 'Settings',
    edit: 'Edit',
    favorite: 'Favorite',
    unfavorite: 'Unfavorite',
    delete: 'Delete',
    export: 'Export',
    exportTitle: 'Export {title}',
    sharingUnavailableTitle: 'Sharing unavailable',
    sharingUnavailableBody: 'Sharing is not available on this device.',
    exportFailedTitle: 'Export failed',
    exportFailedBody: 'Could not export this trip.',
    deleteTitle: 'Delete trip',
    deleteConfirm: 'Delete "{title}"? This can’t be undone.',
    cancel: 'Cancel',
  },
} satisfies Dict;

export type Messages = typeof en;
