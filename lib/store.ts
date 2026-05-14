import { create } from 'zustand';
import { Trip, TripSummary } from './schema';
import { loadState, saveState, loadTrip, saveTrip } from './storage';

interface TripStore {
  trips: TripSummary[];
  activeTrip: Trip | null;
  initialized: boolean;

  initialize: () => Promise<void>;
  addTrip: (trip: Trip) => Promise<void>;
  setActiveTrip: (id: string) => Promise<void>;
  removeTrip: (id: string) => Promise<void>;
}

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(trips: TripSummary[], activeTripId: string | null): void {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    saveState({
      activeTripId,
      trips,
      lastUpdated: new Date().toISOString(),
    }).catch(console.error);
  }, 300);
}

export const useTripStore = create<TripStore>((set, get) => ({
  trips: [],
  activeTrip: null,
  initialized: false,

  async initialize() {
    const state = await loadState();
    if (!state) {
      set({ initialized: true });
      return;
    }
    let activeTrip: Trip | null = null;
    if (state.activeTripId) {
      activeTrip = await loadTrip(state.activeTripId);
    }
    set({ trips: state.trips, activeTrip, initialized: true });
  },

  async addTrip(trip: Trip) {
    await saveTrip(trip);
    const summary: TripSummary = {
      id: trip.id,
      title: trip.title,
      startDate: trip.startDate,
      endDate: trip.endDate,
      isActive: trip.isActive,
    };
    const updatedTrips = get().trips.map((t) => ({ ...t, isActive: false })).concat(summary);
    set({ trips: updatedTrips, activeTrip: trip });
    scheduleSave(updatedTrips, trip.id);
  },

  async setActiveTrip(id: string) {
    const trip = await loadTrip(id);
    if (!trip) return;
    const updatedTrips = get().trips.map((t) => ({ ...t, isActive: t.id === id }));
    set({ trips: updatedTrips, activeTrip: trip });
    scheduleSave(updatedTrips, id);
  },

  async removeTrip(id: string) {
    const { deleteTrip } = await import('./storage');
    await deleteTrip(id);
    const updatedTrips = get().trips.filter((t) => t.id !== id);
    const activeTrip = get().activeTrip?.id === id ? null : get().activeTrip;
    set({ trips: updatedTrips, activeTrip });
    scheduleSave(updatedTrips, activeTrip?.id ?? null);
  },
}));
