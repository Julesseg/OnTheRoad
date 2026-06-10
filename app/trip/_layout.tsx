import { Stack } from 'expo-router';

export default function TripLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/item" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen
        name="location-picker"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [1.0],
        }}
      />
    </Stack>
  );
}
