# Android Port — Plan

Porting On the Road from iOS-only to a second, platform-native Android target.
Strategy and the load-bearing trade-offs are recorded in
[ADR-0015](adr/0015-android-port-platform-native.md); this doc is the executable
step list. Decisions that shaped it (from the grilling session):

| Question | Decision |
|---|---|
| Look & feel | **Platform-native on each** — Material 3 on Android, no Liquid-Glass/SF-Symbol clone |
| Forms (`@expo/ui/swift-ui`) | **Rewrite Android variants in `@expo/ui/jetpack-compose`** (iOS keeps SwiftUI) |
| Map renderer | **`GoogleMaps.View`** on Android (needs a Google Maps SDK key; rendering is free) |
| Road-following routes | **Straight-line fallback on Android v1** (MKDirections is iOS-only; no keyless Android API) |
| Share Capture | **Deferred** to a post-v1 fast-follow |
| Build & distribution | **Local builds only** (`expo run:android`); signed-APK CI later |
| Delivery | **One big port PR** on `claude/android-port-planning-i9xw9b`; tracked by GitHub issues |

## Definition of done (v1)

The app builds and launches on a current Android emulator/device via
`expo run:android`, and every core flow works: browse/create/edit trips and
days, edit items (all categories), the map renders with pins + straight-leg
routes + the location picker, wallpaper, import/export + Schema Prompt,
appearance, and "open in maps." iOS is unchanged. Share Capture is **out of
scope**.

## Workstreams

The work lands as one PR but is organised into these surfaces. Rough dependency
order: **0 → 1** unblock everything; 2–6 are largely parallel; 7 is verification.

### 0. Boot: make Android build & launch

- Set `android.package` to the real id (currently `com.anonymous.ontheroad`).
- Provision a Google Cloud **Maps SDK for Android** API key; wire it via
  `app.config.js` from env (mirror the `APPLE_TEAM_ID` pattern; add to
  `.env.example`). Confirm `expo-maps` Android config picks it up.
- `npx expo prebuild --platform android` and get a clean Gradle build.
- Triage every package for Android support and the `patches/expo-maps` patch
  (Apple-only files — verify it doesn't break the Android build).
- **Exit:** `expo run:android` launches to the home screen (even if unstyled).

### 1. Icon abstraction (unblocks every screen)

- `item-identity.ts` carries an SF Symbol per category; add a parallel Material
  symbol per category so Android has an icon source.
- Replace **direct** `SymbolView` usage (`pin-info-card`, `glass-button`,
  `item-editor`) with the platform-resolving `IconSymbol` (or a small wrapper),
  so iOS keeps SF Symbols and Android gets Material icons. The existing
  `icon-symbol.tsx` fallback only maps 6 symbols — extend the mapping or move to
  `@expo/ui/jetpack-compose` `Icon` / `@expo/vector-icons`.

### 2. Maps (`components/trip-map.tsx`)

- Split into `trip-map.ios.tsx` (existing `AppleMaps.View`) and
  `trip-map.android.tsx` (`GoogleMaps.View`) behind the shared `TripMapHandle`
  props contract.
- Port pins, polylines (straight legs only on Android), camera framing/recenter,
  dimming, result/dropped pins, and pin-tap → info card to the Google Maps API.
- Routing needs **no change**: `routeLeg` returns null on Android → straight-line
  fallback fires automatically.
- Verify the location picker (`location-search-sheet` + map) works on Android.

### 3. Forms (8 screens) → `@expo/ui/jetpack-compose`

`item-editor`, `trip-form`, `itinerary-panel`, `location-search-sheet`,
`days`, `dates`, `trips`, `settings`.

- For each, add an Android variant using the Compose namespace
  (`Column`/`Card`/`ListItem`/`DropdownMenu`/`SegmentedButton`/`DatePicker`/
  `Switch`/`TextField`) reproducing the iOS form's behaviour, not its chrome.
- No `Form`/`Section` in Compose — rebuild grouped lists with `Column` + cards.
- Re-map `swift-ui/modifiers` usage to Compose modifiers or RN styles.
- Keep the shared props/handlers; only the render tree diverges per platform.

### 4. Glass & chrome → Material

- `map-control-button`, `pin-info-card`, `glass-button`: Android variants using
  Material surfaces/elevation instead of `GlassView`.
- `progressive-blur` (`expo-blur`): verify/replace acceptably on Android.

### 5. Preferred maps app (`lib/maps.ts`)

- Make the available-apps set platform-aware: drop **Apple Maps** on Android,
  default to **Google Maps**, offer **Waze** when installed.
- Reconcile a stored `apple` preference → Google Maps on Android (extend the
  existing uninstalled-app reconciliation). Update the settings picker options.
- Android URL probing: `android.intentFilters`/`queries` for `comgooglemaps`,
  `waze` (iOS uses `LSApplicationQueriesSchemes`).

### 6. Wallpaper & misc platform checks

- Confirm `expo-image-picker` → `saveWallpaper` copy works with Android
  `content://` URIs (the copy-on-pick already abstracts the source path).
- Status bar, splash, adaptive icon (assets already present in `app.json`),
  safe-area, haptics, clipboard, document-picker, sharing — smoke-test each.
- `userInterfaceStyle`/appearance: confirm `Appearance.setColorScheme()` applies
  on Android.

### 7. Verification

- `npm run lint` and `npm test` green (the vitest `expo-maps` mock already
  exports both `AppleMaps` and `GoogleMaps`).
- Manual pass of every core flow on an Android emulator against the DoD above.
- Confirm iOS still builds and behaves unchanged.

## Explicitly out of scope (post-v1 fast-follows)

- **Share Capture on Android** — `ACTION_SEND` intent-filter + intake bridge
  (e.g. `expo-share-intent`) feeding the existing `classifyShare` + Share editor.
- **Road-following routes on Android** — would need Google Directions (metered)
  or a self-hosted/community routing server.
- **Android CI + signed-APK distribution** — a Gradle/keystore lane mirroring the
  iOS GitHub Pages build-history flow.
