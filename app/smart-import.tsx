import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';

import { useThemeColors } from '@/constants/theme';

/**
 * Placeholder for Smart Import (user-facing: Import Planning Document). The
 * real flow — availability gate, document input, on-device structuring (see
 * ADR-0006) — lands in the next slice; for now the entry point navigates
 * here and explains itself instead of working.
 */
export default function SmartImportSheet() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>Import Planning Document</Stack.Title>

      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: isDark ? '#8e8e93' : '#6d6d72' }]}>
          Smart Import isn’t available yet.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, textAlign: 'center', paddingHorizontal: 32 },
});
