import React from 'react';

import { LocationSearchSheet } from '@/components/location-search-sheet';

// The search sheet presented over the Location Picker map (ADR-0012). Pure host
// for the sheet component; all state lives in the shared picker store.
export default function LocationSearchScreen() {
  return <LocationSearchSheet />;
}
