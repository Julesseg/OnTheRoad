# Android Port — Verification (#178)

Verification record for the Android port (#170). Tracks the workstream surfaces
(#171–#177) against the v1 Definition of Done in
[android-port-plan.md](android-port-plan.md).

## Automated verification (this environment)

- `npm test` — **green** (full suite). The vitest `expo-maps` stub exports both
  `AppleMaps` and `GoogleMaps`, and `@expo/ui/jetpack-compose` +
  `@expo/vector-icons/MaterialIcons` are stubbed for jsdom, so every Android
  variant is exercised alongside its iOS twin.
- `npm run lint` — **0 errors** (only pre-existing `exhaustive-deps` /
  `import/first` style warnings, matched 1:1 by the iOS twins).
- `npx tsc --noEmit` — **clean**. This is the CI typecheck step that vitest
  (esbuild) does not run, so it was run explicitly to catch type drift in the
  Compose variants against the real `@expo/ui/jetpack-compose` types.

Every Android surface ships a behavioural test: the `GoogleMaps` map
(`trip-map.android.test`), all eight Compose form screens, the Material chrome
(`map-control-button` / `glass-button` / `pin-info-card` / `progressive-blur`),
and the platform-aware maps logic (`maps.platform.test`).

## iOS unchanged

The port adds Android paths rather than rewriting shared ones:

- Every divergent surface keeps its base file as the iOS implementation
  (swift-ui / AppleMaps / GlassView / SF Symbols) and gains a parallel
  `*.android.tsx`. Metro resolves the variant on Android and the base on iOS.
- `icon-symbol.ios.tsx` (the iOS SF-Symbol render) is untouched.
- The few shared edits are iOS-render-identical or additive: the direct
  `SymbolView` → `IconSymbol` swaps render the same `SymbolView` on iOS;
  `item-identity` only **adds** a `materialSymbol`; `lib/maps.ts` branches on
  `Platform.OS` and leaves the iOS URL/app set output identical.
- All pre-existing iOS-base tests pass, confirming behaviour is unchanged.

## Workstream status

| # | Surface | Status |
|---|---|---|
| 171 | Boot: app id + Maps SDK key wiring | code complete |
| 172 | Icon abstraction (SF → Material) | code complete |
| 173 | Maps → `GoogleMaps.View` | code complete |
| 174 | Forms (8 screens) → Jetpack Compose | code complete |
| 175 | Glass & chrome → Material | code complete |
| 176 | Preferred maps app (drop Apple Maps) | code complete |
| 177 | Wallpaper & misc platform checks | code complete |

## Deferred: on-device pass

The DoD's manual run of every core flow on an Android emulator/device via
`expo run:android` is **not** performable in this CI environment (no Android
SDK/emulator). It remains the final gate before the `android-port` → `main`
integration PR. Manual checklist:

- [ ] `expo run:android` builds (Gradle) and launches to the home screen.
- [ ] Trips: browse/create/edit/delete, archived partition.
- [ ] Days + items: all categories, time, checklist, location pick.
- [ ] Map: pins + straight-leg routes + recenter + location picker + pin cards.
- [ ] Wallpaper pick/save (content:// URIs), import/export + Schema Prompt.
- [ ] Appearance (System/Light/Dark) and open-in-maps (Google/Waze).
