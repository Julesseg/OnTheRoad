# App Store screenshots

Screenshots are the one listing asset that must be **captured from the running
app** — they can't be generated from the repo. This file is the capture plan:
what sizes Apple needs, which screens to shoot, and the captions to overlay.

Drop the finished images into locale folders next to this file so they sit beside
the rest of the metadata, e.g.:

```
store/screenshots/en-US/01_upcoming.png
store/screenshots/fr-FR/01_upcoming.png
```

## Required sizes (iPhone)

Apple now derives smaller sizes automatically, so you only need to upload the
largest iPhone size:

- **6.9" iPhone** — 1320 × 2868 px (portrait). Capture on an iPhone 16/17 Pro Max
  simulator, or the iPhone 17 Pro the `run` skill launches and let App Store
  Connect scale, **or** also provide 6.5" (1284 × 2778) to be safe.
- 3–10 screenshots per localization (aim for 5–6 strong ones).

### iPad note

`app.json` currently sets `ios.supportsTablet: true`. If that stays true, App
Store Connect will **also require 13" iPad screenshots** (2064 × 2752). Since v1
is described as iPhone-focused, the simplest path is to set
`supportsTablet: false` before submission so only iPhone screenshots are needed.
Decide this before capturing. (This is a recommendation, not yet changed in the
config.)

## Shots to capture (in order)

| # | Screen | What to show | Caption (EN) | Caption (FR) |
| - | --- | --- | --- | --- |
| 1 | **Upcoming** tab | An in-progress trip with the next item highlighted | Always know what's next | Sachez toujours ce qui suit |
| 2 | **Trips** list | A few trips with status badges and cover photos | All your road trips, beautifully organized | Tous vos road trips, bien organisés |
| 3 | **Day itinerary** | One day's items: a place, a stay, a meal | Plan every day, stop by stop | Planifiez chaque jour, étape par étape |
| 4 | **Map / route** | The trip route following roads between pins | See your whole route on the map | Tout votre trajet sur la carte |
| 5 | **Location Picker** | Searching for a place, result pins on the map | Add any place in seconds | Ajoutez un lieu en quelques secondes |
| 6 | **Settings / privacy** | Maps app choice; or a "stays on your iPhone" beat | Local-first. No account. Works offline. | Local-first. Sans compte. Hors ligne. |

Use a trip with real-looking content (a recognizable city, a couple of cover
photos) and shoot in both light and dark if you want variety. Keep one language
per locale folder — capture the simulator in French (system language) for the
`fr-FR` set.

## How to capture

1. Launch the app on the simulator (`/run` skill → iPhone 17 Pro, or an iPhone
   16/17 Pro Max for the native 6.9" frame).
2. Seed a good-looking trip (or import a sample JSON).
3. `Cmd+S` in the simulator saves a screenshot to the Desktop, already at device
   resolution.
4. Optionally add caption text/frames with a tool like Fastlane `frameit` or
   any design tool, then export and place into the locale folder above.
