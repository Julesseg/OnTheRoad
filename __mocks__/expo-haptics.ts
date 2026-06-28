// Test-only stub for the native `expo-haptics` module, aliased in vitest.config.ts
// so node/jsdom tests can import the haptics helper (and anything that uses it,
// like the store) without the native runtime. Triggers are no-ops here; tests
// that assert on haptic behavior mock `./haptics` or `expo-haptics` per-case.
export const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
} as const;

export const ImpactFeedbackStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
  Soft: 'soft',
  Rigid: 'rigid',
} as const;

export async function notificationAsync() {}
export async function impactAsync() {}
export async function selectionAsync() {}
