import React, { useState } from 'react';
import { Animated, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/constants/theme';

/**
 * Android (Material 3) twin of map-control-button.tsx. The iOS Liquid-Glass map
 * control becomes a circular Material surface — a tonal filled container with
 * elevation instead of GlassView (ADR-0015) — keeping the same press spring and
 * the platform-resolving IconSymbol. Base file is untouched; Metro picks this on
 * Android.
 */
export function MapControlButton({
  name,
  accessibilityLabel,
  color,
  style,
  onPress,
}: {
  name: React.ComponentProps<typeof IconSymbol>['name'];
  accessibilityLabel: string;
  color: string;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  const c = useThemeColors();
  const [scale] = useState(() => new Animated.Value(1));
  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 8 }).start();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => springTo(0.86)}
      onPressOut={() => springTo(1)}
      style={style}
    >
      <Animated.View
        style={[styles.button, { backgroundColor: c.surface, transform: [{ scale }] }]}
      >
        <IconSymbol name={name} size={22} color={color} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    // Material 3 minimum touch target is 48dp.
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    // Material elevation: a real shadow on Android, soft fallback elsewhere.
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});
