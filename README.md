# On the Road

A personal road-trip itinerary app for iOS, built with React Native and Expo.

Plan a trip day by day and keep everything you need for the road in one place. Each trip is a sequence of days, and each day holds an ordered list of items:

- **Locations** — places to stop, with an address you can tap to open in Maps
- **Accommodations** — check-in / check-out times and confirmation numbers
- **Activities** — things to do, with a time and duration
- **Notes** — free-form reminders

The app has three tabs:

- **Upcoming** — the trip in progress today (or the next one coming up), with the next item on your schedule highlighted
- **Trips** — all your trips with status badges (In progress / Upcoming / Past); create a new trip or import one from a JSON file
- **Settings** — pick your preferred maps app (Apple Maps, Google Maps, or Waze) for opening addresses

Trips are stored locally on the device as JSON files (local-first, no account or network required) and can be imported and exported.

## Tech stack

- [Expo](https://expo.dev) (SDK 56) + [Expo Router](https://docs.expo.dev/router/introduction) for file-based, typed routing
- React Native 0.85 / React 19
- [Zustand](https://github.com/pmndrs/zustand) for state, [Zod](https://zod.dev) for schema validation, [React Hook Form](https://react-hook-form.com) for forms
- [Vitest](https://vitest.dev) for unit tests

## Prerequisites

- [Node.js](https://nodejs.org) (LTS) and npm
- macOS with [Xcode](https://developer.apple.com/xcode/) and the iOS Simulator — the app is iOS-only and relies on native modules (native tabs, the iOS 26 glass effect), so it needs a development build rather than Expo Go.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build and run on the iOS Simulator (this compiles the native iOS project):

   ```bash
   npm run ios
   ```

   The first build takes a few minutes. On subsequent runs you can start just the dev server with:

   ```bash
   npm start
   ```

   then press `i` to open the already-installed app on the simulator.

## Development

- **Run tests:**

  ```bash
  npm test
  ```

- **Lint:**

  ```bash
  npm run lint
  ```

App screens live in the `app/` directory (file-based routing), and shared logic — schema, storage, and the trip store — lives in `lib/`.
