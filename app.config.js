// Extends the static app.json with values that shouldn't live in version
// control. APPLE_TEAM_ID and GOOGLE_MAPS_API_KEY are read from the environment
// (see .env.example) so the Apple developer identity and the Google Maps SDK key
// stay out of this public repo. Expo's CLI auto-loads .env files, so a local .env
// is enough for builds.
//
// The Android map (GoogleMaps.View, ADR-0015) needs a Maps SDK for Android key;
// prebuild writes android.config.googleMaps.apiKey into the manifest as
// com.google.android.geo.API_KEY, which expo-maps reads at runtime.
const appJson = require('./app.json');

module.exports = () => ({
  ...appJson.expo,
  ios: {
    ...appJson.expo.ios,
    appleTeamId: process.env.APPLE_TEAM_ID,
  },
  android: {
    ...appJson.expo.android,
    config: {
      ...appJson.expo.android.config,
      googleMaps: {
        ...appJson.expo.android.config?.googleMaps,
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
  },
});
