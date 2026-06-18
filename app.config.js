// Extends the static app.json with values that shouldn't live in version
// control. APPLE_TEAM_ID is read from the environment (see .env.example) so the
// Apple developer identity stays out of this public repo. Expo's CLI auto-loads
// .env files, so a local .env is enough for builds.
const appJson = require('./app.json');

module.exports = () => ({
  ...appJson.expo,
  ios: {
    ...appJson.expo.ios,
    appleTeamId: process.env.APPLE_TEAM_ID,
  },
});
