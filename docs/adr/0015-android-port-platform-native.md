# The Android port is platform-native, not an iOS reskin

## Status

accepted — extends the app from iOS-only (see [CONTEXT.md](../../CONTEXT.md))
to a second platform. Touches the native-forms choice
([ADR-0003](0003-native-forms-over-custom-rn.md)), the road-following route
([ADR-0009](0009-road-following-trip-route.md)), and Share Capture
([ADR-0008](0008-share-capture-thin-share-extension.md)).

## Context

On the Road was built iOS-first and leans hard into a specific iOS-26 idiom:
**Liquid Glass** (`expo-glass-effect`) on map controls and cards, **SF Symbols**
(`expo-symbols`) everywhere, **native SwiftUI forms** (`@expo/ui/swift-ui`,
ADR-0003) on eight screens, **Apple Maps** (`expo-maps` `AppleMaps.View`) as the
map surface, road-following routes from a native **MKDirections** module
(ADR-0009), and a native **Share Extension** (`@bacons/apple-targets`, ADR-0008).
None of these exist on Android. A port therefore can't be a thin recompile; it
has to decide, per surface, between three shapes: clone the iOS look in custom
cross-platform RN, build a true Android-native (Material) experience, or ship
something minimal and unstyled.

## Decision

**Android is a first-class platform-native app, not a pixel-clone of iOS.** The
two platforms are allowed to look different; each uses its own native idiom.
Concretely:

1. **Look & feel: platform-native on each.** Android renders in Material 3 with
   standard Android components and Material icons. We do not reproduce Liquid
   Glass or SF Symbols on Android — glass surfaces become Material
   surfaces/elevation, and the per-category SF Symbols in `item-identity.ts` gain
   parallel Material symbol names. Divergence is expressed with React Native's
   platform-extension resolution (`*.ios.tsx` / `*.android.tsx`) over a shared
   props contract, following the existing `icon-symbol.ios.tsx` pattern.

2. **Forms: rewrite in `@expo/ui/jetpack-compose`.** The eight SwiftUI screens
   stay on `@expo/ui/swift-ui` for iOS (ADR-0003 is preserved, not reversed) and
   get Android variants built on the Jetpack Compose namespace — genuinely native
   Material controls, not an RN approximation. Compose has no `Form`/`Section`;
   the grouped-list scaffolding is rebuilt with `Column` + `Card`/`ListItem`,
   which is the idiomatic Material shape anyway.

3. **Map renderer: `GoogleMaps.View`.** Android swaps `AppleMaps.View` for
   `expo-maps` `GoogleMaps.View`, which requires a Google Cloud Maps SDK for
   Android key in config (map rendering itself is free). The Apple-only POI patch
   in `patches/expo-maps` does not apply to Android.

4. **Routes: straight lines on Android for v1.** MKDirections is iOS-only and
   Android has no keyless first-party directions API. The `routeLeg` `LegRouter`
   already loads via `requireOptionalNativeModule('MKDirections')`, which returns
   null on Android, and null already triggers the straight-line fallback — so the
   Android route degrades gracefully with zero new code, no API key, and no new
   external host. Road-following on Android is deferred (it would mean a metered
   Google Directions call or a fragile public routing server).

## Considered Options

- **Clone the iOS look in custom cross-platform RN** (rebuild glass, SF Symbols,
  and forms as shared components). Rejected: maximum work, fights both
  frameworks, and reverses the deliberate native-forms win of ADR-0003 to land
  somewhere that looks fully native on neither platform.
- **Functional-first, minimal styling** (plain RN, vector-icon font, no chase of
  either aesthetic). Rejected: fastest to "runs," but leaves Android visibly
  unfinished for a shipping app.
- **One shared HTTP routing provider for both platforms.** Rejected: regresses
  ADR-0009's no-key/no-host iOS win and adds metered cost, to give Android a
  feature v1 doesn't need.

## Consequences

- **Two native UI stacks to maintain** (SwiftUI + Jetpack Compose) behind shared
  TypeScript. Each form change is now potentially two edits. Accepted as the cost
  of native-on-each.
- **The route looks rougher on Android** (straight legs) than iOS (real roads).
  Intentional for v1; the fallback styling already reads as "approximate."
- **Share Capture is deferred on Android.** Its iOS App-Group/Share-Extension
  intake (ADR-0008) has no Android analogue yet; the Android intake (an
  `ACTION_SEND` intent-filter feeding the existing `classifyShare` + Share editor,
  both reusable) is the first post-v1 Android feature, not part of this port.
- **The "Preferred maps app" set is platform-dependent.** Apple Maps doesn't
  exist on Android; a stored `apple` preference reconciles to Google Maps on
  Android, mirroring the existing uninstalled-app reconciliation in `lib/maps.ts`.
- **Distribution stays manual for now.** The port targets local builds
  (`expo run:android`); a signed-APK CI lane mirroring the iOS GitHub Pages flow
  is left for later.
- **iOS is untouched.** Every decision preserves the existing iOS surfaces; the
  port adds Android paths rather than rewriting shared ones.
