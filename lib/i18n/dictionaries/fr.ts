import type { Messages } from './en';

/**
 * The French dictionary, typed against the English {@link Messages} source of
 * truth: a missing or renamed key fails to compile. Where a value would just
 * repeat English (none here yet), omit it and `t()` falls back to English at
 * runtime — never the raw key.
 */
export const fr: Messages = {
  status: {
    inProgress: 'En cours',
    upcoming: 'À venir',
    past: 'Passé',
  },
  unit: {
    day: { one: 'jour', other: 'jours' },
    week: { one: 'semaine', other: 'semaines' },
    month: { one: 'mois', other: 'mois' },
    year: { one: 'an', other: 'ans' },
  },
  unitAbbr: {
    day: 'j',
    week: 'sem',
    month: 'mois',
    year: 'an',
  },
  countdown: {
    now: 'Maintenant',
    inProgress: 'En cours',
    before: 'dans {value} {unit}',
    after: 'il y a {value} {unit}',
    startsIn: 'Commence dans {value} {unit}',
    endedAgo: 'Terminé il y a {value} {unit}',
    compactBefore: 'dans {abbr}',
    compactAfter: 'il y a {abbr}',
  },
  trips: {
    title: 'Voyages',
    empty: 'Aucun voyage',
    pastSection: 'Voyages passés',
    new: 'Nouveau voyage',
    import: 'Importer un voyage',
    addTrip: 'Ajouter un voyage',
    settings: 'Réglages',
    edit: 'Modifier',
    favorite: 'Favori',
    unfavorite: 'Retirer des favoris',
    delete: 'Supprimer',
    export: 'Exporter',
    exportTitle: 'Exporter {title}',
    sharingUnavailableTitle: 'Partage indisponible',
    sharingUnavailableBody: 'Le partage n’est pas disponible sur cet appareil.',
    exportFailedTitle: 'Échec de l’export',
    exportFailedBody: 'Impossible d’exporter ce voyage.',
    deleteTitle: 'Supprimer le voyage',
    deleteConfirm: 'Supprimer « {title} » ? Cette action est irréversible.',
    cancel: 'Annuler',
  },
};
