# App icon — source & build guide

Starter kit for the **On the Road** app icon: a retro side-view camper at
sunset, drawn in the app's "Ember" palette so the icon and the UI share a
family resemblance. Final assembly happens in **Apple Icon Composer** (ships
with Xcode 26) to get the iOS 26 Liquid Glass look with light / dark / tinted
appearances.

## Files

| File | Role |
|------|------|
| `layer-1-background.svg` | Back layer — sunset sky, sun, ground |
| `layer-2-van.svg`        | Middle layer — the camper (transparent bg) |
| `layer-3-foreground.svg` | Front layer — clouds + birds (catch the glass highlight) |
| `preview-composite.svg` / `.png` | Flattened preview only — **not** used in the build |

All layers share the same 1024×1024 canvas, so they stack pixel-aligned when
imported into Icon Composer.

## Palette (from `constants/theme.ts`)

| Use | Hex |
|-----|-----|
| Coral (van body) | `#bc5234` / `#b84c30` |
| Gold (trim, hubs, sun) | `#cda23e` / `#c8b468` / `#f7dd92` |
| Cream (upper body, clouds) | `#ece4d4` / `#fbf3e2` |
| Sky → sunset | `#f4ecd8` → `#e6a06e` → `#d97e54` |
| Earth (ground) | `#caa46e` / `#b8915c` |
| Window glass | `#9cc0c4` / `#bcdadd` |
| Ink (tires) | `#2a2622` |

## Two ways to get the layer art

### A. Vector (these SVGs)
Crisp, flat, fully recolorable. Edit the `layer-*.svg` files directly, or open
them in Figma / Affinity / Illustrator. Then either import the SVGs into Icon
Composer or export each layer to a 1024×1024 transparent PNG first.

### B. AI-generated (richer / illustrated look)
Generate each layer separately on a transparent background, then clean up to a
1024×1024 transparent PNG. Suggested prompts:

- **Background:** "Flat vector illustration, warm sunset sky gradient from pale
  cream at top to coral-orange at the horizon, a large soft glowing gold sun
  low and centered, gentle rolling tan-earth ground along the bottom, no
  outlines, muted earthy retro palette, 1:1 square, full bleed."
- **Van:** "Flat vector illustration of a cute retro 1960s camper van, side
  profile facing right, two-tone paint — cream upper half and warm terracotta
  lower half with a thin gold trim stripe, soft round wheels with cream
  hubcaps, a small roof rack, rounded friendly shapes, no background
  (transparent), centered, no text."
- **Foreground:** "A few soft cream stylized clouds and two tiny distant birds,
  flat vector, transparent background, sparse, top half of frame."

Keep the van centered with margin from the edges — iOS clips the corners and
Icon Composer adds depth/parallax.

## Assemble in Icon Composer

1. Open **Icon Composer**, new icon, drag in the three layers (background at
   the back, foreground at the front).
2. Nudge to taste, then set the three **appearances**:
   - **Default / light** — full color (as previewed).
   - **Dark** — let it auto-derive, then darken the sky/ground if needed.
   - **Tinted** — the grayscale/luminance pass the system recolors; check the
     van still reads.
3. Tune blur / translucency / specular, then **export → `OnTheRoad.icon`** into
   this folder.

## Wire it into Expo (SDK 56)

Expo SDK 56 consumes Icon Composer files natively
(`@expo/prebuild-config` → `withIosIcons.js`). A `.icon` file **must** be passed
as a plain string to `ios.icon` — not the `{light,dark,tinted}` object (those
PNGs are the older iOS 18 path) and not the root `icon` property; both log
warnings. The light/dark/tinted variants live *inside* the `.icon` file.

```jsonc
// app.json
"ios": {
  "icon": "./assets/icons/OnTheRoad.icon"
  // ...keep the rest of the ios block
}
```

Then rebuild and preview on the iOS 26 simulator:

```sh
npx expo prebuild -p ios --clean   # copies the .icon into the Xcode project
# then run via the project's `run` skill
```

> The `.icon` is a folder/bundle — make sure it's committed as a directory.
