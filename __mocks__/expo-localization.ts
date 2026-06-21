// Test-only stub for `expo-localization`, aliased in vitest.config.ts so node/
// jsdom tests resolve the locale without the native runtime. Defaults to an
// English device; tests that exercise the French path inject a locale explicitly
// through the pure, locale-accepting helpers rather than re-mocking this.
export function getLocales() {
  return [
    {
      languageTag: 'en-US',
      languageCode: 'en',
      regionCode: 'US',
      textDirection: 'ltr' as const,
      decimalSeparator: '.',
      digitGroupingSeparator: ',',
      measurementSystem: 'us' as const,
      currencyCode: 'USD',
      currencySymbol: '$',
      temperatureUnit: 'fahrenheit' as const,
    },
  ];
}
