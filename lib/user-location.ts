// The slice of expo-location the app depends on, named as a gateway so the
// permission / center-on-user logic can be unit-tested with a fake (see
// CONTEXT.md#user-location).
export interface LocationGateway {
  getForegroundPermissionsAsync(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  requestForegroundPermissionsAsync(): Promise<{ granted: boolean }>;
  getCurrentPositionAsync(): Promise<{ coords: { latitude: number; longitude: number } }>;
}

/**
 * Ensure when-in-use location permission, prompting once if it hasn't been
 * decided. Returns whether the app may show the user's position. Never prompts
 * again once the user has answered (canAskAgain false) — the caller routes to
 * Settings instead.
 */
export async function requestUserLocationPermission(gateway: LocationGateway): Promise<boolean> {
  const current = await gateway.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await gateway.requestForegroundPermissionsAsync()).granted;
}

export type CenterOnUserResult =
  | { kind: 'located'; coordinates: { latitude: number; longitude: number } }
  | { kind: 'denied' };

/**
 * Resolve where the center-on-user button should move the camera: the user's
 * current position when permission is (or becomes) granted, or a `denied` signal
 * telling the caller to route the traveller to Settings rather than dead-ending.
 */
export async function centerOnUser(gateway: LocationGateway): Promise<CenterOnUserResult> {
  const granted = await requestUserLocationPermission(gateway);
  if (!granted) return { kind: 'denied' };
  const { coords } = await gateway.getCurrentPositionAsync();
  return { kind: 'located', coordinates: { latitude: coords.latitude, longitude: coords.longitude } };
}
