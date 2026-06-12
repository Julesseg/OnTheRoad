import { create } from 'zustand';
import { AppearanceMode, Item, MapsApp, Trip, TripSummary } from './schema';
import { loadState, saveState, loadTrip, saveTrip, deleteTrip, importTripFromFile } from './storage';
import { getInstalledMapsApps, reconcilePreferredMapsApp } from './maps';
import { applyAppearance } from './appearance';
import {
  upsertItemInTrip,
  deleteItemFromTrip,
  moveItemToDay,
  reorderItemInDay,
} from './trip-mutations';
import { resolveActiveTrip } from './active-trip';
import type { DayFilterOverride } from './today-filter';
import { todayString } from './date-utils';

interface TripStore {
  trips: TripSummary[];
  loadedTrips: Record<string, Trip>;
  activeTripId: string | null;
  displayedTripId: string | null;
  todayFilterOverride: DayFilterOverride;
  preferredMapsApp: MapsApp;
  appearance: AppearanceMode;
  installedMapsApps: MapsApp[];
  initialized: boolean;
  initializing: boolean;

  initialize: () => Promise<void>;
  addTrip: (trip: Trip) => Promise<void>;
  updateTrip: (trip: Trip) => void;
  importTrip: (uri: string) => Promise<Trip>;
  loadTripById: (id: string) => Promise<void>;
  removeTrip: (id: string) => Promise<void>;
  upsertItem: (tripId: string, dayId: string, item: Item) => void;
  deleteItem: (tripId: string, dayId: string, itemId: string) => void;
  moveItem: (tripId: string, fromDayId: string, toDayId: string, itemId: string) => void;
  reorderItem: (tripId: string, dayId: string, sourceIndices: number[], destination: number) => void;
  setPreferredMapsApp: (app: MapsApp) => void;
  setAppearance: (mode: AppearanceMode) => void;
  setFavorite: (id: string) => void;
  clearFavorite: () => void;
  setDisplayedTrip: (id: string) => void;
  resetDisplayedTrip: () => void;
  setTodayFilterOverride: (value: string | boolean) => void;
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
}));
