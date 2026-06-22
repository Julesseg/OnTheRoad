// Test-only stub for react-native-safe-area-context. Aliased in vitest.config.ts so
// jsdom UI tests can render components that read the safe-area insets (e.g. the
// Android modal screens that pad their in-content header below the status bar)
// without pulling in the package's native/Flow source. Insets are zero in tests,
// so layout assertions are unaffected by the device status-bar inset.
import React, { type ReactNode } from 'react';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const frame = { x: 0, y: 0, width: 0, height: 0 };

export const useSafeAreaInsets = () => insets;
export const useSafeAreaFrame = () => frame;
export const SafeAreaInsetsContext = React.createContext(insets);
export const SafeAreaFrameContext = React.createContext(frame);
export const initialWindowMetrics = { insets, frame };

export function SafeAreaProvider({ children }: { children?: ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

export function SafeAreaView({ children, ...props }: { children?: ReactNode }) {
  return React.createElement('div', props, children);
}
