import React, { useState } from 'react';
import { Animated, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView } from 'expo-glass-effect';

import { IconSymbol } from '@/components/ui/icon-symbol';

/**
 * A floating liquid-glass map control (recenter-on-route, center-on-user). Matches
 * the native MapKit controls' glass look and springs on press so tapping it reads
 * as a deliberate action — the camera move it triggers animates natively.
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
  const [scale] = useState(() => new Animated.Value(1));
  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 8 }).start();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => springTo(0.86)}
      onPressOut={() => springTo(1)}
      style={style}
    >
      <Animated.View style={[styles.button, { transform: [{ scale }] }]}>
        {/* The glass rounds its own corners; clipping it with overflow:'hidden' on
            the parent would cut off the edge highlights. */}
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          style={[StyleSheet.absoluteFill, styles.glass]}
        />
        <IconSymbol name={name} size={22} color={color} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  glass: { borderRadius: 22 },
});
