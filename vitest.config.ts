import { defineConfig } from 'vitest/config';
import path from 'node:path';

const alias = {
  'react-native': 'react-native-web',
  'expo-maps': path.resolve(__dirname, '__mocks__/expo-maps.tsx'),
  '@expo/vector-icons/MaterialIcons': path.resolve(__dirname, '__mocks__/expo-vector-icons.tsx'),
  '@expo/vector-icons': path.resolve(__dirname, '__mocks__/expo-vector-icons.tsx'),
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
