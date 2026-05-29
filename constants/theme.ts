/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Palette = {
  accent: '#E86A2C',
  accentDark: '#FF8A4C',
  accentSoft: 'rgba(232,106,44,0.12)',
  accentSoftDark: 'rgba(255,138,76,0.16)',
  bg: '#F2F2F7',
  bgDark: '#0A0A0C',
  card: '#FFFFFF',
  cardDark: '#1C1C1E',
  text: '#0A0A0C',
  textDark: '#FFFFFF',
  text2: 'rgba(60,60,67,0.62)',
  text2Dark: 'rgba(235,235,245,0.6)',
  text3: 'rgba(60,60,67,0.32)',
  text3Dark: 'rgba(235,235,245,0.32)',
  sep: 'rgba(60,60,67,0.12)',
  sepDark: 'rgba(84,84,88,0.55)',
  locationTint: '#E86A2C',
  stayTint: '#7B5BCC',
  activityTint: '#3E8E58',
  noteTint: '#8A8A93',
  statusProgress: '#5BC27E',
};

export function useTheme(colorScheme: string | null | undefined) {
  const dark = colorScheme === 'dark';
  return {
    dark,
    accent: dark ? Palette.accentDark : Palette.accent,
    accentSoft: dark ? Palette.accentSoftDark : Palette.accentSoft,
    bg: dark ? Palette.bgDark : Palette.bg,
    card: dark ? Palette.cardDark : Palette.card,
    text: dark ? Palette.textDark : Palette.text,
    text2: dark ? Palette.text2Dark : Palette.text2,
    text3: dark ? Palette.text3Dark : Palette.text3,
    sep: dark ? Palette.sepDark : Palette.sep,
  };
}
