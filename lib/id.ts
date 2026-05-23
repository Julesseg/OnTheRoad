// The RN runtime has no global `crypto` (Expo's winter runtime doesn't polyfill
// it and none is installed), so `crypto.randomUUID()` throws. Generate v4 UUIDs
// in pure JS instead — adequate for local-first personal IDs, not crypto-strong.
export function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
