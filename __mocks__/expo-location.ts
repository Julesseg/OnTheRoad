// Test-only stub for the native `expo-location` module, aliased in vitest.config.ts
// so jsdom/node tests can import it without the native runtime. Defaults to a
// denied, no-longer-askable permission (a fresh Simulator with location off);
// tests that exercise the granted path mock these per-case.
export const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
} as const;

export async function getForegroundPermissionsAsync() {
  return { granted: false, canAskAgain: false, status: 'denied' as const };
}

export async function requestForegroundPermissionsAsync() {
  return { granted: false, canAskAgain: false, status: 'denied' as const };
}

export async function getCurrentPositionAsync() {
  return { coords: { latitude: 0, longitude: 0 } };
}
