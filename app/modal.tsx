import { Link } from 'expo-router';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function ModalScreen() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <View style={[styles.container, { backgroundColor: Colors[scheme].background }]}>
      <Text style={[styles.title, { color: Colors[scheme].text }]}>This is a modal</Text>
      <Link href="/(tabs)" dismissTo style={styles.link}>
        <Text style={styles.linkText}>Go to home screen</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 16,
    lineHeight: 30,
    color: Colors.light.tint,
  },
});
