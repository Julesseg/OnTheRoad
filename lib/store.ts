import { create } from 'zustand';
import { Item, MapsApp, Trip, TripSummary } from './schema';
import { loadState, saveState, loadTrip, saveTrip, deleteTrip } from './storage';
import { getInstalledMapsApps } from './maps';
import { upsertItemInTrip, deleteItemFromTrip } from './trip-mutations';

interface TripStore {
  trips: TripSummary[];
  loadedTrips: Record<string, Trip>;
  preferredMapsApp: MapsApp;
  installedMapsApps: MapsApp[];
  initialized: boolean;
  initializing: boolean;

  initialize: () => Promise<void>;
  addTrip: (trip: Trip) => Promise<void>;
  loadTripById: (id: string) => Promise<void>;
  removeTrip: (id: string) => Promise<void>;
  upsertItem: (tripId: string, dayId: string, item: Item) => void;
  deleteItem: (tripId: string, dayId: string, itemId: string) => void;
  setPreferredMapsApp: (app: MapsApp) => void;
}

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function persistState(state: { trips: TripSummary[]; preferredMapsApp: MapsApp }): void {
  try {
    saveState({
      activeTripId: null,
      trips: state.trips,
      preferredMapsApp: state.preferredMapsApp,
      lastUpdated: new Date().toISOString(),
    });
  } catch (e) {
    console.error(e);
  }
}

function scheduleSave(state: { trips: TripSummary[]; preferredMapsApp: MapsApp }): void {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => persistState(state), 300);
}

function toSummary(trip: Trip): TripSummary {
  return {
    id: trip.id,
    title: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
  };
}

export const useTripStore = create<TripStore>((set, get) => ({
  trips: [],
  loadedTrips: {},
  preferredMapsApp: 'apple',
  installedMapsApps: ['apple'],
  initialized: false,
  initializing: false,

  async initialize() {
    if (get().initializing || get().initialized) return;
    set({ initializing: true });
    try {
      const state = await loadState();
      set({
        trips: state?.trips ?? [],
        preferredMapsApp: state?.preferredMapsApp ?? 'apple',
        initialized: true,
        initializing: false,
      });
    } catch {
      // Corrupt or missing state — treat as fresh start so the UI unblocks.
      set({ initialized: true, initializing: false });
    }
    getInstalledMapsApps()
      .then((apps) => set({ installedMapsApps: apps }))
      .catch(() => {});
  },

  async addTrip(trip: Trip) {
    saveTrip(trip);
    const summary = toSummary(trip);
    const updatedTrips = get().trips.concat(summary);
    set((s) => ({ trips: updatedTrips, loadedTrips: { ...s.loadedTrips, [trip.id]: trip } }));
    scheduleSave({ trips: updatedTrips, preferredMapsApp: get().preferredMapsApp });
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

  async removeTrip(id: string) {
    deleteTrip(id);
    const updatedTrips = get().trips.filter((t) => t.id !== id);
    set((s) => {
      const { [id]: _removed, ...rest } = s.loadedTrips;
      return { trips: updatedTrips, loadedTrips: rest };
    });
    scheduleSave({ trips: updatedTrips, preferredMapsApp: get().preferredMapsApp });
  },

  setPreferredMapsApp(app: MapsApp) {
    set({ preferredMapsApp: app });
    persistState({ trips: get().trips, preferredMapsApp: app });
  },
}));
