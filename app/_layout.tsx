import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from 'react-native';
import { LightTokens, DarkTokens } from '@/constants/theme';
import { useTripStore } from '@/lib/store';
import {
  SHEET_DETENTS,
  INITIAL_SHEET_DETENT_INDEX,
  MIN_SHEET_DETENT_INDEX,
} from '@/lib/sheet-detents';

const EmberLightTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary:      LightTokens.accent,
    background:   LightTokens.background,
    card:         LightTokens.surface,
    text:         LightTokens.text,
    border:       LightTokens.separator,
    notification: LightTokens.accent,
  },
};

const EmberDarkTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary:      DarkTokens.accent,
    background:   DarkTokens.background,
    card:         DarkTokens.surface,
    text:         DarkTokens.text,
    border:       DarkTokens.separator,
    notification: DarkTokens.accent,
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // A tapped pin opens the day sheet at the XS peek so its info card has room
  // above the sheet; re-presenting is the only way to drive the native detent
  // (react-native-screens has no imperative detent setter), so the home screen
  // re-presents /days and this picks the matching initial detent.
  const pinSelected = useTripStore((s) => s.selectedPinId !== null);
  const daysInitialDetent = pinSelected ? MIN_SHEET_DETENT_INDEX : INITIAL_SHEET_DETENT_INDEX;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? EmberDarkTheme : EmberLightTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen
            name="days"
            options={{
              presentation: 'formSheet',
              // XS peek, medium, full — opening at medium, or XS while a pin's
              // info card is showing (see lib/sheet-detents).
              sheetAllowedDetents: [...SHEET_DETENTS],
              sheetInitialDetentIndex: daysInitialDetent,
              // Largest index stays undimmed: the map shows through at every detent.
              sheetLargestUndimmedDetentIndex: 2,
              sheetGrabberVisible: true,
              // Permanent sheet: swipe-to-dismiss disabled, resize-only.
              gestureEnabled: false,
            }}
          />
          <Stack.Screen name="trip" />
          {/* Share Capture deep-link target: ontheroad://share?url=…&text=…
              routes here on cold-start or warm launch (ADR-0008). Presented as a
              modal like the item editor it wraps. */}
          <Stack.Screen name="share" options={{ presentation: 'modal' }} />
          <Stack.Screen
            name="trips"
            options={{
              presentation: 'formSheet',
              sheetGrabberVisible: true,
              sheetAllowedDetents: [1.0],
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              presentation: 'formSheet',
              sheetGrabberVisible: true,
              sheetAllowedDetents: [1.0],
            }}
          />
          <Stack.Screen
            name="import"
            options={{
              presentation: 'formSheet',
              sheetGrabberVisible: true,
              sheetAllowedDetents: [1.0],
            }}
          />
          <Stack.Screen
            name="import-paste"
            options={{
              presentation: 'formSheet',
              sheetGrabberVisible: true,
              sheetAllowedDetents: [1.0],
            }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
