import { Stack } from 'expo-router';

export default function TripLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/item" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/edit" options={{ presentation: 'modal' }} />
      {/* The Location Picker is map-centered (ADR-0012): a single full-screen page.
          fullScreenModal (not a plain push) so the map is edge-to-edge instead of
          inset within the editor's own modal frame. */}
      <Stack.Screen name="location-picker" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
