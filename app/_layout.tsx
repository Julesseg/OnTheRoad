import type { ComponentProps } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Platform, useColorScheme } from 'react-native';
import { LightTokens, DarkTokens } from '@/constants/theme';
import { useTripStore } from '@/lib/store';
import {
  SHEET_DETENTS,
  INITIAL_SHEET_DETENT_INDEX,
  MIN_SHEET_DETENT_INDEX,
} from '@/lib/sheet-detents';

// trips / settings / import / import-paste are single-destination screens, not
// resizable sheets. On Android a formSheet pinned to one 1.0 detent renders as a
// full-screen panel that still wears a bottom-sheet grabber + rounded corners over
// the map peeking above — non-native. So Android presents them as a full-screen
// `modal` (no grabber, no map-peek; the in-content SheetHeader is the top app bar),
// while iOS keeps the formSheet it was designed around.
type ScreenOptions = ComponentProps<typeof Stack.Screen>['options'];
const fullScreenSheet: ScreenOptions =
  Platform.OS === 'android'
    ? { presentation: 'modal', headerShown: false }
    : {
        presentation: 'formSheet',
        headerShown: true,
        sheetGrabberVisible: true,
        sheetAllowedDetents: [1.0],
      };

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
              // Header is shown from mount so the screen's declarative
              // <Stack.Header> only styles it — toggling header visibility in a
              // formSheet remounts the screen (RN screens warning).
              headerShown: true,
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
          <Stack.Screen name="trips" options={fullScreenSheet} />
          <Stack.Screen name="settings" options={fullScreenSheet} />
          <Stack.Screen name="import" options={fullScreenSheet} />
          <Stack.Screen name="import-paste" options={fullScreenSheet} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
