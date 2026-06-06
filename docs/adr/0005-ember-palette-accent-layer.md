# Ember palette as a branded accent layer over native chrome

## Status

accepted — revisits the native-iOS-look direction of
[ADR-0002](0002-hybrid-native-trip-sheet-header.md) and
[ADR-0003](0003-native-forms-over-custom-rn.md), and re-skins the per-Item
accents established in ADR-0003 / [ADR-0004](0004-single-item-type-category-as-metadata.md).

## Context

The app reads as **bland**. ADR-0002/0003 deliberately leaned on the stock iOS
look — Liquid Glass, native grouped `@expo/ui/swift-ui` lists and forms, and the
system semantic colors (action-blue `#007AFF`, destructive-red `#FF3B30`,
swipe-orange `#FF9500`). That bought free platform polish but left the app
without an identity of its own. The colour layer is also a mess: the Expo
scaffold `Colors` in `constants/theme.ts` is **dead** (nothing imports it), and
the real colours are hardcoded inline across ~10 files as `useColorScheme()`
ternaries (plus two stray "accent" values, `#007AFF` and a teal `#0a7ea4`).

We want a distinct scheme based on [embertheme.com](https://embertheme.com) — a
warm single-hue base ramp (amber, H≈42°) with **one vivid coral spark** and a
set of muted accents in a narrow lightness band — in both light and dark.

Ember is an **editor** theme, so its roles (keywords/strings/comments) don't map
onto app roles (background/surface/accent/destructive); its vibe has to be
*translated*, not copied. And not every surface is recolourable:

- **Recolourable:** `@expo/ui` content (`foregroundStyle`, `tint`,
  `listRowBackground`), map route overlays (marker `tintColor`, polyline
  `color`), the RN-navigation theme, and the plain-`View` screen/sheet
  backgrounds.
- **Not freely recolourable:** the native grouped-`List` canvas + separators
  (`listStyle('insetGrouped')` draws the system grouped background, driven by
  `Host colorScheme`), Liquid Glass / progressive-blur materials (tintable but
  stay frosted), native `Alert` (destructive button is always system-red), and
  the Apple Maps base tiles (light/dark only).

## Decision

Adopt Ember as a **branded accent/identity layer over the native chrome**, not a
full custom skin. Concretely:

- **Coral becomes the global interactive tint**, replacing action-blue `#007AFF`
  (and the stray teal) everywhere: buttons, links, the today marker, the Next-up
  card, glass pill tints, and the map route pins + polyline.
- **Destructive uses Ember Rose** at its natural muted strength; the trash icon +
  "Delete" label carry the danger cue. Coral never doubles as destructive.
- **Secondary actions use a cool Ember accent** (Steel/Sage) — e.g. the "Move to
  day" swipe — to preserve the warm/cool, safe/destructive contrast that a fully
  warm palette would erase.
- **Per-Item accents remap onto the Ember ramp**, clear of coral + rose: Place =
  Olive, Stay = Steel, Activity = Sage, Note = Mauve (was terracotta / indigo /
  green / warm-gray). Recorded in [CONTEXT.md](../../CONTEXT.md#item).
- **Two-layer palette, one hook.** A raw Ember palette (named colours, the single
  source of truth, rewriting `constants/theme.ts`) → semantic role tokens
  (light + dark) → a `useThemeColors()` hook every component consumes.
  `item-identity` sources its accents from the palette; the RN nav `ThemeProvider`
  is built from it. **Every** inline colour is routed through this layer (full
  cleanup, no stragglers).
- **Warm screen backgrounds, native list canvas left alone.** The plain-`View`
  sheet/screen backgrounds adopt the Ember warm base; the native grouped-`List`
  canvas keeps the system grouped background. The warm bg showing around the
  inset list is intentional.
- **Standard Ember (dark) + Ember Light**, not Ember Soft (higher contrast for a
  road-trip app used outdoors).
- **Appearance toggle** — a `System / Light / Dark` setting persisted in
  `AppState` (mirroring `preferredMapsApp`), applied globally via RN
  `Appearance.setColorScheme()` so native surfaces follow the override too. New
  glossary term **Appearance**.
- **Ember hexes verbatim** as the source palette, with minimal *documented*
  contrast tweaks only where a role fails legibility in-app (e.g. `onAccent`
  text, or a too-light accent used as a fill).

## Considered options

- **Full Ember skin** — also override the grouped-list canvas via
  `scrollContentBackground(.hidden)` + a custom warm background. Rejected: fights
  the platform, risks clashing with the un-themeable Apple Maps, and walks back
  ADR-0002/0003 further than warranted.
- **Keep systemBlue, coral only for brand moments.** Rejected: too timid to shed
  the "bland" feel.
- **Threaded `useResolvedColorScheme()` hook** instead of
  `Appearance.setColorScheme()`. Rejected: native `Alert`s and unhosted native UI
  wouldn't follow the in-app toggle — a light/dark seam.
- **NativeWind / Unistyles / Tamagui.** Rejected: heavy dependency that cuts
  against the native `@expo/ui` direction.

## Consequences

- This **partly revisits** the native-cohesion stance of ADR-0002/0003: the app
  no longer reads as stock iOS. That is the point of this ADR — a future reader
  who sees system-blue replaced by coral, or delete in rose rather than
  system-red, should know it was deliberate.
- **Seams that must not be "fixed":** the native `Alert` destructive button stays
  system-red; the grouped-`List` canvas stays the system grouped colour (the warm
  screen background around it is intentional, not a bug); the Apple Maps base
  tiles can't take the palette.
- Adds an `appearance` field to `AppStateSchema` (defaulted, backward-compatible)
  and a new **Appearance** glossary entry; the **App State** entry is updated to
  list it.
- `lib/item-identity.test.ts`'s "reserved colours" invariant moves from
  `{#FF3B30, #007AFF}` to `{coral, rose}` — item accents must stay clear of the
  interactive and destructive colours.
</content>
</invoke>
