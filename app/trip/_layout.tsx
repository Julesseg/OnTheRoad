import { Stack } from 'expo-router';

export default function TripLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/item" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/dates" options={{ presentation: 'modal' }} />
      {/* The Location Picker is map-centered (ADR-0012): a full-screen map with the
          search sheet over it. fullScreenModal (not a plain push) so the map is
          edge-to-edge instead of inset within the editor's own modal frame; the
          explicit slide animation eases it up from the bottom instead of appearing
          abruptly. */}
      <Stack.Screen
        name="location-picker"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="location-search"
        options={{
          presentation: 'formSheet',
          // Two detents over the full-screen map: 0.5 is search, 0.1 a peek that
          // hands the map nearly the full screen. The detent only resizes the
          // sheet — tapping the map drops a pin at either size. Open at 0.5; at the
          // peek the sheet surfaces the selected row's name as its title.
          sheetAllowedDetents: [0.1, 0.5],
          sheetInitialDetentIndex: 1,
          // Never dim the map beneath — result/dropped pins must stay visible.
          sheetLargestUndimmedDetentIndex: 'last',
          sheetGrabberVisible: true,
          // No title; let the system glass material show through over the map.
          title: '',
          headerTransparent: true,
          contentStyle: { backgroundColor: 'transparent' },
          // Resize-only: buttons cancel the pick — not a swipe-to-dismiss.
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
