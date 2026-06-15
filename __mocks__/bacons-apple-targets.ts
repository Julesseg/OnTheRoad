// Test stub for @bacons/apple-targets. The real ExtensionStorage module touches the
// Expo native runtime at import time (`expo is not defined` under vitest), so the
// vitest config aliases the package here. The app's share-bridge-native layer only
// uses the App Group accessors, which are no-ops in tests.
export class ExtensionStorage {
  set(_key: string, _value?: unknown): void {}
  get(_key: string): string | null {
    return null;
  }
  remove(_key: string): void {}
  static reloadWidget(_name?: string): void {}
  static reloadControls(_name?: string): void {}
}
