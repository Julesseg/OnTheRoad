import { create } from 'zustand';
import { Trip, TripSummary } from './schema';
import { loadState, saveState, loadTrip, saveTrip, deleteTrip } from './storage';

interface TripStore {
  trips: TripSummary[];
  activeTrip: Trip | null;
  initialized: boolean;
  initializing: boolean;

  initialize: () => Promise<void>;
  addTrip: (trip: Trip) => Promise<void>;
  setActiveTrip: (id: string) => Promise<void>;
  removeTrip: (id: string) => Promise<void>;
}

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(trips: TripSummary[], activeTripId: string | null): void {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    try {
      saveState({ activeTripId, trips, lastUpdated: new Date().toISOString() });
    } catch (e) {
      console.error(e);
    }
  }, 300);
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
  activeTrip: null,
  initialized: false,
  initializing: false,

  async initialize() {
    if (get().initializing || get().initialized) return;
    set({ initializing: true });
    try {
      const state = await loadState();
      if (!state) {
        set({ initialized: true, initializing: false });
        return;
      }
      let activeTrip: Trip | null = null;
      if (state.activeTripId) {
        try {
          activeTrip = await loadTrip(state.activeTripId);
        } catch {
          activeTrip = null;
        }
      }
      set({ trips: state.trips, activeTrip, initialized: true, initializing: false });
    } catch {
      // Corrupt or missing state — treat as fresh start so the UI unblocks.
      set({ initialized: true, initializing: false });
    }
  },

  async addTrip(trip: Trip) {
    saveTrip(trip);
    const summary = toSummary(trip);
    const updatedTrips = get().trips.concat(summary);
    set({ trips: updatedTrips, activeTrip: trip });
    scheduleSave(updatedTrips, trip.id);
  },

  async setActiveTrip(id: string) {
    const trip = await loadTrip(id);
    if (!trip) return;
    set({ activeTrip: trip });
    scheduleSave(get().trips, id);
  },

  async removeTrip(id: string) {
    deleteTrip(id);
    const updatedTrips = get().trips.filter((t) => t.id !== id);
    const activeTrip = get().activeTrip?.id === id ? null : get().activeTrip;
    set({ trips: updatedTrips, activeTrip });
    scheduleSave(updatedTrips, activeTrip?.id ?? null);
  },
}));
