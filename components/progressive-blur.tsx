import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { easeGradient } from 'react-native-easing-gradient';

type BlurTint = React.ComponentProps<typeof BlurView>['tint'];
type GradientColors = React.ComponentProps<typeof LinearGradient>['colors'];
type GradientLocations = React.ComponentProps<typeof LinearGradient>['locations'];

/**
 * A *progressive* (variable-radius) blur: full strength at the top edge, easing to
 * nothing at the bottom. Rather than fading a single uniform blur's opacity — which
 * snaps from fully-blurred to sharp — it stacks `layers` horizontal bands, each a
 * masked `expo-blur` BlurView whose intensity steps down with depth, so the effective
 * blur radius ramps smoothly. Bands feather into their neighbours to avoid seams.
 *
 * The whole stack is then wrapped in an eased fade-out envelope (via
 * react-native-easing-gradient) so the bottom edge dissolves into the sharp content
 * below instead of hard-cutting at the stack boundary.
 * (Technique inspired by rit3zh/expo-progressive-blur.)
 *
 * Render as an absolutely positioned layer over scrolling content; non-interactive,
 * so taps fall through to content above it.
 */
export function ProgressiveBlurView({
  intensity = 50,
  tint = 'systemChromeMaterial',
  layers = 8,
  style,
}: {
  intensity?: number;
  tint?: BlurTint;
  layers?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const band = 1 / layers;

  // Smooth, eased alpha envelope: fully opaque down to ~60%, then easing to
  // transparent at the very bottom so the whole blur dissolves rather than cuts off.
  const envelope = easeGradient({
    colorStops: {
      0: { color: 'black' },
      0.9: { color: 'black' },
      1: { color: 'transparent' },
    },
  });

  return (
    <MaskedView
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
      maskElement={
        <LinearGradient
          style={StyleSheet.absoluteFill}
          colors={envelope.colors as unknown as GradientColors}
          locations={envelope.locations as unknown as GradientLocations}
        />
      }
    >
      <View style={StyleSheet.absoluteFill}>
        {Array.from({ length: layers }).map((_, i) => {
          // Top band blurs at full `intensity`; each lower band is a step weaker.
          const layerIntensity = Math.max(1, Math.round((intensity * (layers - i)) / layers));
          const start = i * band;
          const end = (i + 1) * band;
          // Feather a full band into each neighbour so adjacent radii blend without seams.
          const locations = [Math.max(0, start - band), start, end, Math.min(1, end + band)];
          const colors = ['transparent', 'black', 'black', 'transparent'];
          return (
            <MaskedView
              key={i}
              style={StyleSheet.absoluteFill}
              maskElement={
                <LinearGradient
                  style={StyleSheet.absoluteFill}
                  colors={colors as unknown as GradientColors}
                  locations={locations as unknown as GradientLocations}
                />
              }
            >
              <BlurView intensity={layerIntensity} tint={tint} style={StyleSheet.absoluteFill} />
            </MaskedView>
          );
        })}
      </View>
    </MaskedView>
  );
}
