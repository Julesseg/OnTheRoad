---
name: run
description: Run the on-the-road Expo app on the iOS simulator (iPhone 17 Pro). Use when asked to run, launch, start, or relaunch the app, or to verify a change in the running app. Simulator only by default — only use the physical-device section if the user explicitly asks to run on their iPhone/device.
---

# Run the app

iOS-only Expo app with a prebuilt dev client (`ios/` is checked in). Target simulator: **iPhone 17 Pro**.

## Quick start (simulator)

If the dev client is already installed on the simulator (the usual case), just start Metro and open the app:

```bash
# Start Metro in the background
npx expo start &

# Boot the simulator if needed, then launch the installed dev client
xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || true
open -a Simulator
xcrun simctl launch booted com.anonymous.on-the-road
```

The dev client connects to Metro automatically.

## Full build (when native code changed)

Rebuild when native deps changed (new pods, `@expo/ui` version bumps, config-plugin changes, fresh clone):

```bash
npx expo run:ios --device "iPhone 17 Pro"
```

This compiles the Xcode workspace, installs onto the simulator, starts Metro, and launches the app. First build takes several minutes.

## Verifying changes

- JS/TS changes: Fast Refresh picks them up while Metro runs.
- **Native SwiftUI (`@expo/ui`) changes are NOT reflected by Fast Refresh.** Terminate and relaunch:
  ```bash
  xcrun simctl terminate booted com.anonymous.on-the-road
  xcrun simctl launch booted com.anonymous.on-the-road
  ```
- Screenshot for visual verification:
  ```bash
  xcrun simctl io booted screenshot /tmp/on-the-road.png
  ```

## Troubleshooting

- "No development build installed" / app missing on simulator → run the full build.
- Metro port conflict → `npx expo start --port 8082` (the dev client will prompt), or kill the stale process on 8081.
- Stale native state → `xcrun simctl uninstall booted com.anonymous.on-the-road`, then full build.

## Physical device (only when explicitly requested)

Do not use this path unless the user asks to run on their physical iPhone.

1. Device must be plugged in (or on the same network with Wi-Fi debugging enabled) and unlocked.
2. Find the device UDID:
   ```bash
   xcrun xctrace list devices   # note the device name and UDID (the long hex string)
   ```
3. **Do not rely on `npx expo run:ios --device`.** On iOS 26 devices its JS-based installer fails at the
   `LockdowndClient` handshake (`TypeError: Cannot convert object to primitive value`). The Xcode build it
   runs still succeeds, so use it only to compile, then install/launch with Apple's `devicectl`:
   ```bash
   # Build (this compiles + signs; the install step at the end will error — that's expected)
   npx expo run:ios --device "<device name>"

   # Install the freshly built .app directly (find the path in the run:ios output, under DerivedData)
   APP="$HOME/Library/Developer/Xcode/DerivedData/ontheroad-*/Build/Products/Debug-iphoneos/ontheroad.app"
   xcrun devicectl device install app --device <UDID> $APP

   # Make sure Metro is running, then launch on device
   npx expo start &
   xcrun devicectl device process launch --device <UDID> com.anonymous.on-the-road
   ```
4. Code signing: open `ios/ontheroad.xcworkspace` in Xcode the first time to set the development team if signing fails.
5. On-device relaunches must be done by the user (unlock + tap), per the same Fast-Refresh caveat for native `@expo/ui` changes.
