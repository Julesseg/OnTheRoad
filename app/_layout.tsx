import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from 'react-native';
import { LightTokens, DarkTokens } from '@/constants/theme';

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? EmberDarkTheme : EmberLightTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen
            name="days"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.5, 1],
              sheetInitialDetentIndex: 0,
              // Largest index stays undimmed: the map shows through at every detent.
              sheetLargestUndimmedDetentIndex: 1,
              sheetGrabberVisible: true,
              // Permanent sheet: swipe-to-dismiss disabled, resize-only.
              gestureEnabled: false,
            }}
          />
          <Stack.Screen name="trip" />
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
            name="archived"
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
