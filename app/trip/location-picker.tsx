import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';

import { LocationPicker } from '@/components/location-picker';
import { getLocationPickSession, endLocationPick } from '@/lib/location-picker-session';

export default function LocationPickerScreen() {
  // Capture once: the session is set by the editor right before pushing here.
  const [session] = useState(getLocationPickSession);

  useEffect(() => endLocationPick, []);

  return (
    <LocationPicker
      initialLocation={session?.initialLocation}
      onConfirm={(location) => {
        session?.onConfirm(location);
        router.back();
      }}
      onCancel={() => router.back()}
    />
  );
}
