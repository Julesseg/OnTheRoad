import { Stack } from 'expo-router';

export default function TripLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/item" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/edit" options={{ presentation: 'modal' }} />
      {/* The Location Picker is map-centered (ADR-0012): a full-screen map pushed
          over the editor, with the search sheet (below) presented on top of it. */}
      <Stack.Screen name="location-picker" />
      <Stack.Screen
        name="location-search"
        options={{
          presentation: 'formSheet',
          // Medium search sheet and an XS pin-drop peek; mode is derived from the
          // resting detent (lib/location-search-sheet). Opens at medium.
          sheetAllowedDetents: [0.1, 0.5],
          sheetInitialDetentIndex: 1,
          // Both detents undimmed so the map shows through at either size.
          sheetLargestUndimmedDetentIndex: 1,
          sheetGrabberVisible: true,
          // Resize-only: X cancels, dragging to the peek enters pin mode — neither
          // is a swipe-to-dismiss.
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
