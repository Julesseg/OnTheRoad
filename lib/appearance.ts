import { Appearance } from 'react-native';

import type { AppearanceMode } from './schema';

// Applies the user's Appearance preference app-wide. Setting the RN color
// scheme override makes useColorScheme() (and therefore useThemeColors(),
// every Host colorScheme, the nav ThemeProvider) and native surfaces like
// Alert and grouped lists all follow it; 'unspecified' returns to following
// the OS (ADR-0005).
export function applyAppearance(mode: AppearanceMode): void {
  Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
}
