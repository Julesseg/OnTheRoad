import { defineConfig } from 'vitest/config';
import path from 'node:path';

const alias = {
  'react-native': 'react-native-web',
  'expo-maps': path.resolve(__dirname, '__mocks__/expo-maps.tsx'),
  'expo-location': path.resolve(__dirname, '__mocks__/expo-location.ts'),
  '@bacons/apple-targets': path.resolve(__dirname, '__mocks__/bacons-apple-targets.ts'),
  // The Android (Compose) form variants render through these stubs in jsdom; the
  // native @expo/ui/jetpack-compose runtime can't load in tests. No iOS test
  // imports the Compose namespace, so a global alias is safe. The more specific
  // /modifiers key must precede the namespace key so it matches first.
  '@expo/ui/jetpack-compose/modifiers': path.resolve(
    __dirname,
    '__mocks__/jetpack-compose-modifiers.ts',
  ),
  '@expo/ui/jetpack-compose': path.resolve(__dirname, '__mocks__/jetpack-compose.tsx'),
  '@': path.resolve(__dirname, '.'),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'lib',
          environment: 'node',
          include: ['lib/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['components/**/*.test.tsx', '__tests__/**/*.test.tsx'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
});
