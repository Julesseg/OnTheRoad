import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import type { ItemType } from '@/lib/item-form';
import { ITEM_TYPE_ORDER, itemTypeIdentity } from '@/lib/item-type-identity';

/** Glass sheet for adding an Item to a Day: a 2×2 grid of type cards reporting the canonical type. */
export function ItemTypePicker({
  dayNumber,
  onSelect,
  onClose,
}: {
  dayNumber: number;
  onSelect: (type: ItemType) => void;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const fg = colorScheme === 'dark' ? '#fff' : '#111';

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
        {/* box-none so taps outside the card fall through to the backdrop below. */}
        <View style={styles.center} pointerEvents="box-none">
          <GlassView glassEffectStyle="regular" colorScheme={scheme} style={styles.card}>
            <Text style={[styles.title, { color: fg }]}>{`Add to Day ${dayNumber}`}</Text>
            <View style={styles.grid}>
              {ITEM_TYPE_ORDER.map((type) => {
                const { label, symbol, accent } = itemTypeIdentity(type);
                return (
                  <Pressable
                    key={type}
                    accessibilityLabel={label}
                    style={styles.tile}
                    onPress={() => onSelect(type)}
                  >
                    <SymbolView
                      name={symbol as SymbolViewProps['name']}
                      tintColor={accent}
                      size={34}
                      style={styles.symbol}
                    />
                    <Text style={[styles.tileLabel, { color: accent }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassView>
        </View>
      </View>
    </Modal>
  );
}

const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...fill, backgroundColor: 'rgba(0,0,0,0.4)' },
  center: { ...fill, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 24, overflow: 'hidden', padding: 20, width: 320, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  tile: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  symbol: { width: 34, height: 34 },
  tileLabel: { fontSize: 16, fontWeight: '600' },
});
