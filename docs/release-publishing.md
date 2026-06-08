# Automated Release Publishing

## Goal

When new code is pushed (triggered by a git tag), a build is automatically compiled on a self-hosted Mac runner and made available to install on-device via a single Safari link — no TestFlight, no EAS subscription.

---

## Architecture

```
git push --tags
      │
      ▼
GitHub Actions (self-hosted runner on your Mac)
      │
      ├── npm ci
      ├── npx expo prebuild
      ├── xcodebuild archive
      ├── xcodebuild -exportArchive  →  .ipa
      │
      ▼
GitHub Pages (OTA manifest + .ipa hosted)
      │
      ▼
Safari on iPhone  →  itms-services:// link  →  Install
```

---

## One-Time Setup

### 1. Apple Developer Portal
- Create an **Ad-Hoc distribution certificate** (or reuse your existing one)
- Register your iPhone's **UDID** under Devices
- Create an **Ad-Hoc provisioning profile** that includes your device, download it
- Update `app.json`: replace `com.anonymous.on-the-road` with a real bundle ID (e.g. `com.julesseguin.ontheroad`)

### 2. Mac Runner
- In GitHub: **Settings → Actions → Runners → New self-hosted runner**
- Follow the 4-step instructions GitHub provides (download, configure, start)
- Install it as a background service so it survives reboots:
  ```bash
  ./svc.sh install
  ./svc.sh start
  ```

### 3. GitHub Repository Secrets
Add these under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `APPLE_SIGNING_IDENTITY` | Certificate name from Keychain, e.g. `iPhone Distribution: Jules Seguin (XXXXXXXXXX)` |
| `APPLE_PROVISIONING_PROFILE` | Contents of the `.mobileprovision` file, base64-encoded (`base64 -i profile.mobileprovision`) |
| `APPLE_TEAM_ID` | Your 10-character Apple Team ID |

### 4. GitHub Pages
- In GitHub: **Settings → Pages → Source: GitHub Actions**
- This lets the workflow publish the OTA manifest and `.ipa` to a public URL

---

## What Gets Built

### `eas.json`
Not needed — replaced by a native `ExportOptions.plist` in the repo.

### `.github/workflows/release.yml`
Triggers on `v*` tags (e.g. `v1.0.0`). Steps:
1. Checkout code
2. Install Node deps (`npm ci`)
3. Run `npx expo prebuild --platform ios`
4. Install provisioning profile from secret
5. `xcodebuild archive`
6. `xcodebuild -exportArchive` with ad-hoc export options
7. Publish `.ipa` + OTA `manifest.plist` to GitHub Pages
8. Post the install URL to the GitHub release notes

### `ExportOptions.plist`
Tells Xcode to export as ad-hoc with your provisioning profile.

---

## Installing a Build

1. On your iPhone, open Safari
2. Navigate to the GitHub Pages URL (e.g. `https://julesseg.github.io/OnTheRoad/`)
3. Tap **Install**
4. Trust the certificate in **Settings → General → VPN & Device Management** (first time only)

---

## Trigger

Push a tag to kick off a release build:
```bash
git tag v1.0.0
git push --tags
```

---

## Constraints & Limitations

- **Mac must be on** and the runner service running for builds to trigger
- **Provisioning profile expires** after 1 year — needs to be regenerated and the secret updated
- **Ad-hoc limit:** up to 100 registered devices
- **Bundle ID change:** `com.anonymous.on-the-road` → real ID required before first build
