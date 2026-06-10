import { Platform, useColorScheme } from 'react-native';

/**
 * Raw Ember palette — the single source of truth for every hex value.
 * Source: https://github.com/ember-theme/ember/blob/main/palette.json
 * Standard Ember (dark) + Ember Light (light) variants.
 */
export const EmberPalette = {
  // 8 named accents — dark (Ember) variants
  coral:  '#e08060', // hero accent; interactive tint (replaces action-blue)
  orange: '#c09058',
  gold:   '#c8b468',
  olive:  '#8a9868',
  sage:   '#80a090',
  steel:  '#7890a0', // secondary action
  rose:   '#b07878', // destructive fills
  mauve:  '#988090',

  // 8 named accents — light (Ember Light) variants
  coralLight:  '#b84c30',
  orangeLight: '#946030',
  goldLight:   '#7a6820',
  oliveLight:  '#4a6830',
  sageLight:   '#386858',
  steelLight:  '#3a6080',
  roseLight:   '#905050',
  mauveLight:  '#706070',

  // Base backgrounds / foregrounds
  darkBg:  '#1c1b19',
  darkFg:  '#d8d0c0',
  lightBg: '#e6dac4',
  lightFg: '#282418',
} as const;

export interface ThemeTokens {
  background: string;
  surface: string;
  text: string;
  textSubtle: string;
  accent: string;
  onAccent: string;
  secondaryAction: string;
  destructive: string;
  separator: string;
}

export const LightTokens: ThemeTokens = {
  background:      EmberPalette.lightBg,     // #e6dac4 — warm paper
  surface:         '#ebe4d6',                // H39 S35% L88% — lifted surface
  text:            EmberPalette.lightFg,     // #282418
  textSubtle:      '#81765f',                // H40 S15% L44%
  accent:          EmberPalette.coralLight,  // #b84c30 — interactive (replaces #007AFF / #0a7ea4)
  onAccent:        '#ffffff',
  secondaryAction: EmberPalette.steelLight,  // #3a6080
  destructive:     EmberPalette.roseLight,   // #905050
  separator:       '#ccbea4',                // H39 S28% L72%
};

export const DarkTokens: ThemeTokens = {
  background:      EmberPalette.darkBg,   // #1c1b19
  surface:         '#242320',             // Ember Soft bg — natural +L step
  text:            EmberPalette.darkFg,   // #d8d0c0
  textSubtle:      '#938976',             // H40 S12% L52%
  accent:          EmberPalette.coral,    // #e08060 — interactive (replaces #007AFF / #0a7ea4)
  onAccent:        EmberPalette.darkBg,   // #1c1b19 — dark text on coral (6.13:1 contrast)
  secondaryAction: EmberPalette.steel,    // #7890a0
  destructive:     EmberPalette.rose,     // #b07878
  separator:       '#3d3a34',             // H40 S8% L22%
};

export function useThemeColors(): ThemeTokens {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DarkTokens : LightTokens;
}

export const Fonts = Platform.select({
  ios: {
    sans:    'system-ui',
    serif:   'ui-serif',
    rounded: 'ui-rounded',
    mono:    'ui-monospace',
  },
  default: {
    sans:    'normal',
    serif:   'serif',
    rounded: 'normal',
    mono:    'monospace',
  },
  web: {
    sans:    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif:   "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono:    "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
