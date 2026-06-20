import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useThemeColors } from '@/constants/theme';

/**
 * Android twin of progressive-blur.tsx. The iOS stacked variable-radius blur
 * (expo-blur + MaskedView) is an Apple idiom; Material UIs frost a nav bar with a
 * scrim rather than a live blur, and the masked multi-layer blur is expensive and
 * inconsistent on Android. So this draws an eased background-coloured scrim that
 * fades to transparent — the same "content dissolves under the bar" effect,
 * Material-style (ADR-0015). Same props/signature; `intensity`/`tint`/`layers`
 * are accepted for parity (intensity scales the scrim's opacity).
 *
 * Non-interactive — an absolutely positioned layer over scrolling content.
 */
export function ProgressiveBlurView({
  intensity = 50,
  layers: _layers,
  tint: _tint,
  style,
}: {
  intensity?: number;
  tint?: string;
  layers?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useThemeColors();
  // Cap the top opacity around the intensity so a light `intensity` reads as a
  // subtle scrim and a heavy one as a near-solid bar, mirroring the blur strength.
  const alpha = Math.min(1, Math.max(0, intensity / 100) + 0.25);
  const top = withAlpha(c.background, alpha);
  const mid = withAlpha(c.background, alpha * 0.6);
  const bottom = withAlpha(c.background, 0);

  return (
    <LinearGradient
      pointerEvents="none"
      colors={[top, mid, bottom]}
      locations={[0, 0.65, 1]}
      style={[StyleSheet.absoluteFill, style]}
    />
  );
}

// Theme colours are #rrggbb or #rrggbbaa; rebuild with an explicit alpha byte.
function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '').slice(0, 6).padEnd(6, '0');
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${hex}${a}`;
}
