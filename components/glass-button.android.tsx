import { useEffect, useRef, useState } from 'react';
import { Text, Pressable, Animated, StyleSheet } from 'react-native';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/constants/theme';

/**
 * Android (Material 3) twin of glass-button.tsx. The Liquid-Glass pill becomes a
 * tonal filled button — a Material surface with elevation instead of GlassView
 * (ADR-0015) — keeping the same accent-coloured icon + label and the spring that
 * pops whenever the icon swaps (e.g. to a checkmark on copy). Base file untouched;
 * Metro picks this on Android.
 */
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
  const c = useThemeColors();
  const [scale] = useState(() => new Animated.Value(1));
  const mounted = useRef(false);

  useEffect(() => {
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
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 },
      ]}
    >
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
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonIcon: { width: 18, height: 18 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
