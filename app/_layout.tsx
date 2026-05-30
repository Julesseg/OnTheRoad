import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen
            name="days"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.12, 0.5, 1],
              sheetInitialDetentIndex: 1,
              // Largest index stays undimmed: the map shows through at every detent.
              sheetLargestUndimmedDetentIndex: 1,
              sheetGrabberVisible: true,
              // Permanent sheet: swipe-to-dismiss disabled, resize-only.
              gestureEnabled: false,
            }}
          />
          <Stack.Screen name="trip" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
