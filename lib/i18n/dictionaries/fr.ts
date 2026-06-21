import type { Messages } from './en';

/**
 * The French dictionary, typed against the English {@link Messages} source of
 * truth: a missing or renamed key fails to compile. Where a value would just
 * repeat English (a brand name), omit it and `t()` falls back to English at
 * runtime — never the raw key.
 */
export const fr: Messages = {
  common: {
    cancel: 'Annuler',
    delete: 'Supprimer',
    save: 'Enregistrer',
    done: 'OK',
    edit: 'Modifier',
    start: 'Début',
    end: 'Fin',
    deleteItemTitle: 'Supprimer l’élément',
    deleteItemConfirm: 'Supprimer « {name} » ? Cette action est irréversible.',
  },

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

  itemDisplay: {
    at: 'À {time}',
  },

  category: {
    activity: 'Activité',
    location: 'Lieu',
    stay: 'Hébergement',
    meal: 'Repas',
    note: 'Note',
  },

  trips: {
    title: 'Voyages',
    empty: 'Aucun voyage',
    pastSection: 'Voyages passés',
    new: 'Nouveau voyage',
    import: 'Importer un voyage',
    addTrip: 'Ajouter un voyage',
    settings: 'Réglages',
    favorite: 'Favori',
    unfavorite: 'Retirer des favoris',
    export: 'Exporter',
    exportTitle: 'Exporter {title}',
    sharingUnavailableTitle: 'Partage indisponible',
    sharingUnavailableBody: 'Le partage n’est pas disponible sur cet appareil.',
    exportFailedTitle: 'Échec de l’export',
    exportFailedBody: 'Impossible d’exporter ce voyage.',
    deleteTitle: 'Supprimer le voyage',
    deleteConfirm: 'Supprimer « {title} » ? Cette action est irréversible.',
  },

  home: {
    appName: 'On the Road',
    subtitle: 'Commencez un nouveau voyage ou importez-en un que vous avez déjà.',
    backToDefault: 'Revenir au voyage par défaut',
    filterDay: 'Filtrer le jour',
  },

  settings: {
    mapsApp: 'Application de cartes',
    preferredApp: 'Application préférée',
    appearance: 'Apparence',
    appearanceSystem: 'Système',
    appearanceLight: 'Clair',
    appearanceDark: 'Sombre',
  },

  map: {
    recenter: 'Recentrer',
    centerOnLocation: 'Centrer sur ma position',
  },

  importPaste: {
    title: 'Coller le JSON',
    import: 'Importer',
    placeholder: 'Collez le JSON de votre voyage…',
  },
  import: {
    heading: 'Importer un voyage',
    openPrefix: 'Ouvrez le fichier ',
    openSuffix: ' produit par votre IA, ou collez directement son JSON.',
    chooseFile: 'Choisir un fichier',
    pasteJson: 'Coller le JSON',
    planHeading: 'Vous avez plutôt un plan de voyage ?',
    planDetail:
      'Transformez un plan en texte libre en voyage avec l’IA de votre choix, puis importez le résultat :',
    step1: 'Copiez l’instruction.',
    step2: 'Collez-la dans votre IA préférée avec votre plan de voyage.',
    step3: 'Téléchargez le fichier produit et importez-le ici.',
    copied: 'Copié',
    copyPrompt: 'Copier l’instruction',
    resolving: 'Résolution des lieux…',
    failedTitle: 'Échec de l’import',
    failedBody: 'Impossible d’importer ce voyage.',
    copyFailedTitle: 'Échec de la copie',
    copyFailedBody: 'Une erreur s’est produite lors de la copie de l’instruction. Veuillez réessayer.',
  },

  share: {
    createTripFirst: 'Créez d’abord un voyage',
    createTripHint:
      'Un lieu ou un lien partagé a besoin d’un voyage où vivre. Créez-en un, puis partagez à nouveau.',
  },

  tripForm: {
    newHeading: 'Nouveau voyage',
    create: 'Créer',
    editHeading: 'Modifier le voyage',
    titlePlaceholder: 'Titre',
    datesLabel: 'Dates du voyage · {range}',
    coverPhoto: 'Photo de couverture',
    change: 'Changer',
    remove: 'Retirer',
    addCoverPhoto: 'Ajouter une photo de couverture',
    permissionTitle: 'Autorisation requise',
    permissionMessage:
      'Autorisez l’accès à la photothèque pour ajouter une photo de couverture à ce voyage.',
    saveErrorTitle: 'Erreur',
    saveErrorBody: 'Échec de l’enregistrement du voyage. Veuillez réessayer.',
  },

  dates: {
    title: 'Dates du voyage',
    changingHeader: 'Comment ces dates changent-elles ?',
    shiftFooter:
      'Déplacez tout le voyage — chaque jour conserve ses plans, seules les dates changent.',
    adjustFooter:
      'Redéfinissez la période — les plans des jours hors période passent au jour le plus proche, jamais perdus.',
    shift: 'Décaler le voyage',
    adjust: 'Ajuster les dates',
    newStartHeader: 'Nouvelle date de début',
    newDatesHeader: 'Nouvelles dates',
    endsOn: 'Se termine le {date}',
    moveTitle: 'Déplacer les éléments ?',
    moveMessage:
      'Certains jours sortent des nouvelles dates. Leurs plans sont conservés, pas supprimés — ce qui précède le nouveau début passe à la fin du premier jour, et ce qui suit la nouvelle fin passe à la fin du dernier jour.',
  },

  itemEditor: {
    newHeading: 'Nouveau : {category}',
    editHeading: 'Modifier : {category}',
    openLink: 'Ouvrir {label}',
    time: 'Heure',
    checklistEntry: 'Élément de liste',
    addEntry: 'Ajouter un élément',
    addLocation: 'Ajouter un lieu',
    clearLocation: 'Effacer le lieu',
    tripLabel: 'Voyage',
    pastSuffix: '{label} · Passé',
    titlePlaceholder: 'Titre',
    notesPlaceholder: 'Notes',
    categoryLabel: 'Catégorie',
    dateTitle: 'Date',
    checklistHeader: 'Liste',
    notFound: 'Cet élément est introuvable.',
  },

  itinerary: {
    nextUp: 'À SUIVRE',
    edit: 'Modifier',
    navigate: 'Itinéraire',
  },

  companion: {
    nextUp: 'À suivre',
    notesFor: 'Notes pour {title}',
  },

  locationSearch: {
    placeholder: 'Rechercher ou coller un lieu',
    select: 'Sélectionner',
    resolving: 'Résolution…',
    plainAddress: 'Utiliser « {text} » comme adresse simple',
  },

  pinCard: {
    title: 'Carte d’information du repère',
    openItem: 'Ouvrir l’élément',
    directions: 'Itinéraire',
    openInMaps: 'Ouvrir dans Plans',
  },
};
