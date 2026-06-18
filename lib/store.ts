import { create } from 'zustand';
import { AppearanceMode, Item, MapsApp, Trip, TripSummary } from './schema';
import {
  loadState,
  saveState,
  loadTrip,
  saveTrip,
  deleteTrip,
  importTripFromFile,
  importTripFromText,
} from './storage';
import { getInstalledMapsApps, reconcilePreferredMapsApp } from './maps';
import { geocodeTripLocations } from './geocode-import';
import { applyAppearance } from './appearance';
import {
  upsertItemInTrip,
  deleteItemFromTrip,
  moveItemToDay,
  reorderItemInDay,
  toggleChecklistEntryInTrip,
} from './trip-mutations';
import { resolveActiveTrip } from './active-trip';
import type { DayFilterOverride } from './today-filter';
import { INITIAL_SHEET_DETENT_INDEX } from './sheet-detents';
import { todayString } from './date-utils';
import { writeTripsIndex } from './share-bridge-native';

interface TripStore {
  trips: TripSummary[];
  loadedTrips: Record<string, Trip>;
  activeTripId: string | null;
  displayedTripId: string | null;
  todayFilterOverride: DayFilterOverride;
  sheetDetentIndex: number;
  selectedPinId: string | null;
  preferredMapsApp: MapsApp;
  appearance: AppearanceMode;
  installedMapsApps: MapsApp[];
  initialized: boolean;
  initializing: boolean;

  initialize: () => Promise<void>;
  addTrip: (trip: Trip) => Promise<void>;
  updateTrip: (trip: Trip) => void;
  importTrip: (uri: string) => Promise<Trip>;
  importTripText: (raw: string) => Promise<Trip>;
  loadTripById: (id: string) => Promise<void>;
  removeTrip: (id: string) => Promise<void>;
  upsertItem: (tripId: string, dayId: string, item: Item) => void;
  deleteItem: (tripId: string, dayId: string, itemId: string) => void;
  moveItem: (tripId: string, fromDayId: string, toDayId: string, itemId: string) => void;
  reorderItem: (tripId: string, dayId: string, sourceIndices: number[], destination: number) => void;
  toggleChecklistEntry: (tripId: string, dayId: string, itemId: string, entryId: string) => void;
  setPreferredMapsApp: (app: MapsApp) => void;
  setAppearance: (mode: AppearanceMode) => void;
  setFavorite: (id: string) => void;
  clearFavorite: () => void;
  setDisplayedTrip: (id: string) => void;
  resetDisplayedTrip: () => void;
  setTodayFilterOverride: (value: string | boolean) => void;
  setSheetDetentIndex: (index: number) => void;
  setSelectedPin: (id: string | null) => void;
}

type StateSnapshot = {
  trips: TripSummary[];
  activeTripId: string | null;
  preferredMapsApp: MapsApp;
  appearance: AppearanceMode;
};

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function writeState(snapshot: StateSnapshot): void {
  try {
    saveState({
      activeTripId: snapshot.activeTripId,
      trips: snapshot.trips,
      preferredMapsApp: snapshot.preferredMapsApp,
      appearance: snapshot.appearance,
      lastUpdated: new Date().toISOString(),
    });
    // Mirror the trips into the App Group so the Share Extension's pickers stay
    // current (ADR-0008). Idempotent, so re-mirroring on a settings-only write is fine.
    mirrorTripsIndex(snapshot.trips, snapshot.activeTripId);
  } catch (e) {
    console.error(e);
  }
}

/** Best-effort App Group mirror — never let a share-bridge failure break a state save. */
function mirrorTripsIndex(trips: TripSummary[], activeTripId: string | null): void {
  try {
    writeTripsIndex(trips, activeTripId, todayString());
  } catch (e) {
    console.error(e);
  }
}

// Read the snapshot lazily when the timer fires so a debounced trip save can't
// clobber an immediate setting write made within the debounce window.
function scheduleSave(getSnapshot: () => StateSnapshot): void {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => writeState(getSnapshot()), 300);
}

function toSummary(trip: Trip): TripSummary {
  return {
    id: trip.id,
    title: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
    wallpaperUri: trip.wallpaperUri,
  };
}

function snapshotOf(get: () => TripStore): StateSnapshot {
  return {
    trips: get().trips,
    activeTripId: get().activeTripId,
    preferredMapsApp: get().preferredMapsApp,
    appearance: get().appearance,
  };
}

export const useTripStore = create<TripStore>((set, get) => ({
  trips: [],
  loadedTrips: {},
  activeTripId: null,
  displayedTripId: null,
  todayFilterOverride: null,
  sheetDetentIndex: INITIAL_SHEET_DETENT_INDEX,
  selectedPinId: null,
  preferredMapsApp: 'apple',
  appearance: 'system',
  // Apple Maps always ships with iOS, so default to it until the probe resolves.
  installedMapsApps: ['apple'],
  initialized: false,
  initializing: false,

  async initialize() {
    if (get().initializing || get().initialized) return;
    set({ initializing: true });
    try {
      const state = await loadState();
      const trips = state?.trips ?? [];
      const storedActiveTripId = state?.activeTripId ?? null;
      const resolution = resolveActiveTrip(trips, storedActiveTripId, todayString());
      // Store only the explicit favorite (null if expired); UI derives display trip via resolveActiveTrip.
      const activeTripId = resolution.shouldClearFavorite ? null : storedActiveTripId;
      const preferredMapsApp = state?.preferredMapsApp ?? 'apple';
      const appearance = state?.appearance ?? 'system';
      set({ trips, activeTripId, preferredMapsApp, appearance, initialized: true, initializing: false });
      applyAppearance(appearance);
      // Seed the Share Extension's picker index on launch (writeState below only
      // fires when the favorite was cleared, so mirror here too).
      mirrorTripsIndex(trips, activeTripId);
      if (resolution.shouldClearFavorite) {
        writeState({ trips, activeTripId: null, preferredMapsApp, appearance });
      }
    } catch {
      // Corrupt or missing state — treat as fresh start so the UI unblocks.
      set({ initialized: true, initializing: false });
    }
    getInstalledMapsApps()
      .then((apps) => {
        set({ installedMapsApps: apps });
        const reconciled = reconcilePreferredMapsApp(get().preferredMapsApp, apps);
        if (reconciled !== get().preferredMapsApp) get().setPreferredMapsApp(reconciled);
      })
      .catch(() => {});
  },

  async addTrip(trip: Trip) {
    saveTrip(trip);
    const summary = toSummary(trip);
    const updatedTrips = get().trips.concat(summary);
    set((s) => ({ trips: updatedTrips, loadedTrips: { ...s.loadedTrips, [trip.id]: trip } }));
    scheduleSave(() => snapshotOf(get));
  },

  updateTrip(trip: Trip) {
    saveTrip(trip);
    const summary = toSummary(trip);
    set((s) => ({
      trips: s.trips.map((t) => (t.id === trip.id ? summary : t)),
      loadedTrips: { ...s.loadedTrips, [trip.id]: trip },
    }));
    scheduleSave(() => snapshotOf(get));
  },

  async importTrip(uri: string) {
    const trip = await importTripFromFile(uri);
    // Imported trips (Schema Prompt JSON, ADR-0012) carry addresses but no
    // coordinates, so they'd land with no pins. Resolve address-only items
    // through Photon before saving; failures stay address-only (geocode-import).
    const enriched = await geocodeTripLocations(trip);
    await get().addTrip(enriched);
    return enriched;
  },

  async importTripText(raw: string) {
    const trip = importTripFromText(raw);
    await get().addTrip(trip);
    return trip;
  },

  async loadTripById(id: string) {
    if (get().loadedTrips[id]) return;
    const trip = await loadTrip(id);
    if (!trip) return;
    set((s) => ({ loadedTrips: { ...s.loadedTrips, [id]: trip } }));
  },

  upsertItem(tripId: string, dayId: string, item: Item) {
    const trip = get().loadedTrips[tripId];
    if (!trip) return;
    const next = upsertItemInTrip(trip, dayId, item, new Date().toISOString());
    saveTrip(next);
    set((s) => ({ loadedTrips: { ...s.loadedTrips, [tripId]: next } }));
  },

  deleteItem(tripId: string, dayId: string, itemId: string) {
    const trip = get().loadedTrips[tripId];
    if (!trip) return;
    const next = deleteItemFromTrip(trip, dayId, itemId, new Date().toISOString());
    saveTrip(next);
    set((s) => ({ loadedTrips: { ...s.loadedTrips, [tripId]: next } }));
  },

  moveItem(tripId: string, fromDayId: string, toDayId: string, itemId: string) {
    const trip = get().loadedTrips[tripId];
    if (!trip || fromDayId === toDayId) return;
    const next = moveItemToDay(trip, fromDayId, toDayId, itemId, new Date().toISOString());
    saveTrip(next);
    set((s) => ({ loadedTrips: { ...s.loadedTrips, [tripId]: next } }));
  },

  reorderItem(tripId: string, dayId: string, sourceIndices: number[], destination: number) {
    const trip = get().loadedTrips[tripId];
    if (!trip) return;
    const next = reorderItemInDay(trip, dayId, sourceIndices, destination, new Date().toISOString());
    if (next === trip) return;
    saveTrip(next);
    set((s) => ({ loadedTrips: { ...s.loadedTrips, [tripId]: next } }));
  },

  // Ticking is autosaved: the flipped trip hits storage synchronously, with no
  // Save step and no debounce — independent of any open editor's Save/Cancel.
  toggleChecklistEntry(tripId: string, dayId: string, itemId: string, entryId: string) {
    const trip = get().loadedTrips[tripId];
    if (!trip) return;
    const next = toggleChecklistEntryInTrip(trip, dayId, itemId, entryId, new Date().toISOString());
    if (next === trip) return;
    saveTrip(next);
    set((s) => ({ loadedTrips: { ...s.loadedTrips, [tripId]: next } }));
  },

  async removeTrip(id: string) {
    deleteTrip(id);
    const updatedTrips = get().trips.filter((t) => t.id !== id);
    set((s) => {
      const { [id]: _removed, ...rest } = s.loadedTrips;
      return {
        trips: updatedTrips,
        loadedTrips: rest,
        // Deleting the Displayed Trip drops back to the resolved default; deleting
        // the favorite clears it so the default re-resolves (ADR-0001).
        displayedTripId: s.displayedTripId === id ? null : s.displayedTripId,
        todayFilterOverride: s.displayedTripId === id ? null : s.todayFilterOverride,
        activeTripId: s.activeTripId === id ? null : s.activeTripId,
      };
    });
    scheduleSave(() => snapshotOf(get));
  },

  setPreferredMapsApp(app: MapsApp) {
    set({ preferredMapsApp: app });
    writeState(snapshotOf(get));
  },

  setAppearance(mode: AppearanceMode) {
    set({ appearance: mode });
    applyAppearance(mode);
    writeState(snapshotOf(get));
  },

  setFavorite(id: string) {
    set({ activeTripId: id });
    writeState(snapshotOf(get));
  },

  clearFavorite() {
    set({ activeTripId: null });
    writeState(snapshotOf(get));
  },

  // Displayed Trip is in-memory only: it is absent from StateSnapshot and these
  // setters never call writeState, so it never reaches state.json. A cold start
  // therefore always shows the resolved default, not the last-browsed Trip.
  setDisplayedTrip(id: string) {
    set({ displayedTripId: id, todayFilterOverride: null });
  },

  resetDisplayedTrip() {
    set({ displayedTripId: null, todayFilterOverride: null });
  },

  setTodayFilterOverride(value: string | boolean) {
    set({ todayFilterOverride: value });
  },

  // The /days sheet's resting detent, reported via onSheetDetentChanged. In-memory
  // only (like the Displayed Trip): the home map reads it to frame the route into
  // the area left visible above the sheet at the current detent.
  setSheetDetentIndex(index: number) {
    set({ sheetDetentIndex: index });
  },

  // The trip pin whose info card is showing. Set on pin tap; cleared on empty-map
  // tap or when the day sheet is expanded past the XS detent. In-memory only.
  setSelectedPin(id: string | null) {
    set({ selectedPinId: id });
  },
}));
