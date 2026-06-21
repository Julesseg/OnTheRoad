import type { Dict } from '../translate';

/**
 * The English dictionary — the **source of truth** for the app's UI chrome.
 * Every locale's dictionary is typed against this one (`fr: typeof en`), so a
 * missing or renamed key is a compile error. Only UI chrome lives here; trip
 * titles, item names, notes, and addresses are user content and are never keyed.
 */
export const en = {
  // Generic, reused across screens.
  common: {
    cancel: 'Cancel',
    delete: 'Delete',
    save: 'Save',
    done: 'Done',
    edit: 'Edit',
    start: 'Start',
    end: 'End',
    deleteItemTitle: 'Delete item',
    deleteItemConfirm: 'Delete "{name}"? This can\'t be undone.',
  },

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

  // The formatted item lines shared by the itinerary row and pin info card.
  itemDisplay: {
    at: 'At {time}',
  },

  // Item categories — the warm display label per category (see CONTEXT.md#item).
  category: {
    activity: 'Activity',
    location: 'Place',
    stay: 'Stay',
    meal: 'Meal',
    note: 'Note',
  },

  trips: {
    title: 'Trips',
    empty: 'No trips yet',
    pastSection: 'Past trips',
    new: 'New Trip',
    import: 'Import Trip',
    addTrip: 'Add trip',
    settings: 'Settings',
    favorite: 'Favorite',
    unfavorite: 'Unfavorite',
    export: 'Export',
    exportTitle: 'Export {title}',
    sharingUnavailableTitle: 'Sharing unavailable',
    sharingUnavailableBody: 'Sharing is not available on this device.',
    exportFailedTitle: 'Export failed',
    exportFailedBody: 'Could not export this trip.',
    deleteTitle: 'Delete trip',
    deleteConfirm: 'Delete "{title}"? This can\'t be undone.',
  },

  // The bare-map / empty home screen and its native chrome (days.tsx).
  home: {
    appName: 'On the Road',
    subtitle: 'Start a new trip or import one you already have.',
    backToDefault: 'Back to default trip',
    filterDay: 'Filter day',
  },

  settings: {
    mapsApp: 'Maps app',
    preferredApp: 'Preferred app',
    appearance: 'Appearance',
    appearanceSystem: 'System',
    appearanceLight: 'Light',
    appearanceDark: 'Dark',
  },

  map: {
    recenter: 'Recenter',
    centerOnLocation: 'Center on my location',
  },

  importPaste: {
    title: 'Paste JSON',
    import: 'Import',
    placeholder: 'Paste your trip JSON…',
  },
  import: {
    heading: 'Import a trip',
    openPrefix: 'Open the ',
    openSuffix: ' file your AI produced, or paste its JSON directly.',
    chooseFile: 'Choose File',
    pasteJson: 'Paste JSON',
    planHeading: 'Have a trip plan instead?',
    planDetail: 'Turn a free-text plan into a trip with any AI, then import the result:',
    step1: 'Copy the prompt.',
    step2: 'Paste it into your favorite AI chat with your trip plan.',
    step3: 'Download the file it produces and import it here.',
    copied: 'Copied',
    copyPrompt: 'Copy Prompt',
    resolving: 'Resolving locations…',
    failedTitle: 'Import failed',
    failedBody: 'Could not import this trip.',
    copyFailedTitle: 'Couldn’t copy',
    copyFailedBody: 'Something went wrong copying the prompt. Please try again.',
  },

  share: {
    createTripFirst: 'Create a trip first',
    createTripHint:
      'A shared place or link needs a trip to live on. Create one, then share again.',
  },

  // The trip create/edit form (trip-form.tsx, new.tsx, edit.tsx).
  tripForm: {
    newHeading: 'New Trip',
    create: 'Create',
    editHeading: 'Edit Trip',
    titlePlaceholder: 'Title',
    datesLabel: 'Trip dates · {range}',
    coverPhoto: 'Cover photo',
    change: 'Change',
    remove: 'Remove',
    addCoverPhoto: 'Add cover photo',
    permissionTitle: 'Permission needed',
    permissionMessage: 'Allow photo library access to add a cover photo for this trip.',
    saveErrorTitle: 'Error',
    saveErrorBody: 'Failed to save trip. Please try again.',
  },

  // The Trip dates screen (dates.tsx).
  dates: {
    title: 'Trip dates',
    changingHeader: 'How are these dates changing?',
    shiftFooter: 'Move the whole trip — every day keeps its plans, only the dates change.',
    adjustFooter:
      'Redefine the span — plans on days that fall outside move to the nearest day, never lost.',
    shift: 'Shift the trip',
    adjust: 'Adjust dates',
    newStartHeader: 'New start date',
    newDatesHeader: 'New dates',
    endsOn: 'Ends {date}',
    moveTitle: 'Move items to fit?',
    moveMessage:
      'Some days fall outside the new dates. Their plans are kept, not deleted — anything before the new start moves to the end of the first day, and anything after the new end moves to the end of the last day.',
  },

  // The single item editor (item-editor.tsx) and the item screen (item.tsx).
  itemEditor: {
    newHeading: 'New {category}',
    editHeading: 'Edit {category}',
    openLink: 'Open {label}',
    time: 'Time',
    toggleEntry: 'Toggle entry {position}',
    checklistEntry: 'Checklist entry',
    addEntry: 'Add entry',
    addLocation: 'Add location',
    clearLocation: 'Clear location',
    tripLabel: 'Trip',
    pastSuffix: '{label} · Past',
    titlePlaceholder: 'Title',
    notesPlaceholder: 'Notes',
    categoryLabel: 'Category',
    dateTitle: 'Date',
    checklistHeader: 'Checklist',
    notFound: 'This item could not be found.',
  },

  // The itinerary list (itinerary-panel.tsx).
  itinerary: {
    nextUp: 'NEXT UP',
    dayHeader: 'Day {n}',
    edit: 'Edit',
    navigate: 'Navigate',
  },

  // The today companion card (today-companion.tsx).
  companion: {
    nextUp: 'Next up',
    notesFor: 'Notes for {title}',
  },

  // The location picker search sheet (location-search-sheet.tsx).
  locationSearch: {
    placeholder: 'Search or paste a location',
    select: 'Select',
    resolving: 'Resolving…',
    plainAddress: "Use '{text}' as a plain address",
  },

  // The map pin info card (pin-info-card.tsx).
  pinCard: {
    title: 'Pin info card',
    openItem: 'Open item',
    directions: 'Directions',
    openInMaps: 'Open in maps',
  },
} satisfies Dict;

export type Messages = typeof en;
