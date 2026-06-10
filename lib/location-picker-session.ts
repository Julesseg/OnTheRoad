import type { Item } from '@/lib/schema';

// Hands the location-pick callback from the item editor to the
// /trip/location-picker route. Route params can't carry functions, and the
// editor's draft state must stay local — so the editor begins a session right
// before pushing the route, and the route screen picks it up on mount.
export interface LocationPickSession {
  initialLocation?: Item['location'];
  onConfirm: (location: Item['location']) => void;
}

let session: LocationPickSession | null = null;

export function beginLocationPick(s: LocationPickSession) {
  session = s;
}

export function getLocationPickSession(): LocationPickSession | null {
  return session;
}

export function endLocationPick() {
  session = null;
}
