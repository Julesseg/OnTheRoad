import { Stack } from 'expo-router';

export default function TripLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/item" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/edit" options={{ presentation: 'modal' }} />
      {/* The Location Picker is map-centered (ADR-0012): a full-screen map with the
          search sheet over it. fullScreenModal (not a plain push) so the map is
          edge-to-edge instead of inset within the editor's own modal frame. */}
      <Stack.Screen name="location-picker" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen
        name="location-search"
        options={{
          presentation: 'formSheet',
          // A half/large sheet over the full-screen map; the map shows through at
          // both detents so result pins stay visible while searching.
          sheetAllowedDetents: [0.5, 0.95],
          sheetLargestUndimmedDetentIndex: 1,
          sheetGrabberVisible: true,
          // Resize-only: X cancels the pick — not a swipe-to-dismiss.
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
