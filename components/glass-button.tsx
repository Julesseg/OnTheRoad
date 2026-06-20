import { useEffect, useRef, useState } from 'react';
import { Text, Pressable, Animated, StyleSheet } from 'react-native';
import { GlassView } from 'expo-glass-effect';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';

// Liquid-glass pill button: an icon + label over the clear Liquid Glass material.
// The glass fills behind via an absolute GlassView that rounds its own corners
// (clipping it with overflow:'hidden' would cut off the edge highlights that give
// Liquid Glass its look). No tint — the material stays clear and the accent-colored
// content reads on top, matching the map controls. The content springs whenever the
// icon changes, so swapping to a checkmark on copy reads as a confirmation.
export function GlassButton({
  label,
  icon,
  accent,
  onPress,
}: {
  label: string;
  icon: IconSymbolName;
  accent: string;
  onPress: () => void;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const mounted = useRef(false);

  useEffect(() => {
    // Skip the initial mount; only pop when the icon actually swaps.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    scale.setValue(0.7);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 14,
    }).start();
  }, [icon, scale]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}
    >
      <GlassView
        glassEffectStyle="regular"
        isInteractive
        style={[StyleSheet.absoluteFill, styles.glass]}
      />
      <Animated.View style={[styles.buttonContent, { transform: [{ scale }] }]}>
        <IconSymbol name={icon} color={accent} size={18} style={styles.buttonIcon} />
        <Text style={[styles.buttonLabel, { color: accent }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Full capsule: a radius >= half the button height rounds the glass completely so
  // the edge highlights wrap the corners instead of being clipped flat.
  glass: { borderRadius: 999 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonIcon: { width: 18, height: 18 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
