import { View, Text, Linking, StyleSheet } from 'react-native';

import { formatItem, linkify } from '@/lib/item-display';
import type { Item } from '@/lib/schema';

export function ItemRow({ item }: { item: Item }) {
  const { typeLabel, title, lines } = formatItem(item);
  return (
    <View style={styles.row}>
      <Text style={styles.typeLabel}>{typeLabel}</Text>
      <Text style={styles.title}>{title}</Text>
      {lines.map((line, i) => (
        <Text key={i} style={styles.line}>
          {linkify(line).map((seg, j) =>
            seg.kind === 'text' ? (
              <Text key={j}>{seg.value}</Text>
            ) : (
              <Text key={j} style={styles.link} onPress={() => Linking.openURL(seg.href)}>
                {seg.value}
              </Text>
            ),
          )}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  typeLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', color: '#888' },
  title: { marginTop: 2, fontSize: 16, fontWeight: '600' },
  line: { marginTop: 4, fontSize: 14, color: '#444' },
  link: { color: '#007AFF' },
});
