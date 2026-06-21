import { defineConfig } from 'vitest/config';
import path from 'node:path';

const alias = {
  'react-native': 'react-native-web',
  'expo-maps': path.resolve(__dirname, '__mocks__/expo-maps.tsx'),
  'expo-location': path.resolve(__dirname, '__mocks__/expo-location.ts'),
  'expo-localization': path.resolve(__dirname, '__mocks__/expo-localization.ts'),
  '@bacons/apple-targets': path.resolve(__dirname, '__mocks__/bacons-apple-targets.ts'),
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
