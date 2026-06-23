# App Store listing assets

Everything needed to fill out the OnTheRoad App Store listing for the first
release, kept in version control so the copy has a reviewable home.

The text metadata follows the [Fastlane `deliver`](https://docs.fastlane.tools/actions/deliver/)
folder layout, so it can be uploaded by hand in App Store Connect **or** driven by
Fastlane later — no lock-in either way.

```
store/
├── README.md            ← you are here
├── app_privacy.md       ← App Privacy "nutrition label" answers + reasoning
├── metadata/
│   ├── en-US/           ← name, subtitle, description, keywords, URLs, …
│   └── fr-FR/           ← French localization (app ships EN + FR)
└── screenshots/
    └── README.md        ← capture plan + captions (images added on capture)
```

## Name vs. home-screen name

These are **two independent fields**, which is what lets the listing read longer
than the icon label:

- **Home-screen name** (`CFBundleDisplayName` in `app.json`): **`OnTheRoad`** —
  already set; this is the label under the icon.
- **App Store name** (`metadata/*/name.txt`): **`OnTheRoad`** — capped at 30
  characters by Apple.
- **App Store subtitle** (`metadata/*/subtitle.txt`): **`Road trip planner &
  companion`** — capped at 30 characters; renders directly beneath the name on the
  product page.

The desired "OnTheRoad: road trip planner and companion" presentation (42 chars)
can't fit in the single 30-char name field, so it's split across name + subtitle —
which is exactly how Apple intends those two fields to work, and reads as
"OnTheRoad / Road trip planner & companion" on the listing.

## Field reference & limits

| File | App Store Connect field | Limit | Notes |
| --- | --- | --- | --- |
| `name.txt` | App Name | 30 | |
| `subtitle.txt` | Subtitle | 30 | |
| `description.txt` | Description | 4000 | |
| `keywords.txt` | Keywords | 100 | comma-separated, no spaces between; words already in the name/subtitle don't need repeating |
| `promotional_text.txt` | Promotional Text | 170 | editable anytime without a new build |
| `release_notes.txt` | What's New | 4000 | |
| `support_url.txt` | Support URL | — | must be a real URL (not mailto) |
| `marketing_url.txt` | Marketing URL | — | optional |
| `privacy_url.txt` | Privacy Policy URL | — | required; see below |

All current values are within limits (verified at authoring time).

## Privacy

- **Policy text:** [`PRIVACY.md`](../PRIVACY.md) (root) is the canonical copy;
  [`site/privacy.html`](../site/privacy.html) is the styled page published to
  GitHub Pages.
- **Public URL (required by Apple):** `https://julesseg.github.io/OnTheRoad/privacy.html`
  To make it live: (1) copy [`github-pages-workflow.yml`](github-pages-workflow.yml)
  to `.github/workflows/pages.yml` on `main` (do this in the GitHub web UI — the
  automated push lacks `workflow` scope), then (2) in the repo **Settings →
  Pages**, set the source to **GitHub Actions**. The workflow publishes only the
  `site/` directory (internal `docs/` are never exposed).
- **App Privacy "nutrition label":** **Data Not Collected.** The app has no
  account, no server, no analytics, and no tracking; everything stays on-device.
  Full answers and the network-touchpoint reasoning are in
  [`app_privacy.md`](app_privacy.md). This matches `ios/ontheroad/PrivacyInfo.xcprivacy`
  (empty `NSPrivacyCollectedDataTypes`, `NSPrivacyTracking false`).

## App Review information (fill in App Store Connect)

- **Sign-in required:** No (the app has no accounts). Leave demo
  username/password blank.
- **Notes for reviewer:** "Local-first app; all data is stored on-device as JSON
  files, no login. Optional network use is limited to user-initiated place search
  (Photon/komoot geocoder) and resolving shared map links. Location and Photos
  permissions are optional and only used on-device."
- **Category:** Travel (suggested; Navigation as secondary).
- **Age rating:** 4+ (no objectionable content; no user-generated public content).

## Pre-submission checklist

- [ ] Copy `store/github-pages-workflow.yml` to `.github/workflows/pages.yml`,
      enable GitHub Pages (Settings → Pages → Source: GitHub Actions), and confirm
      the privacy URL loads.
- [ ] Decide `supportsTablet` (see `screenshots/README.md`); if staying true,
      capture 13" iPad screenshots too.
- [ ] Capture iPhone screenshots per `screenshots/README.md` (EN + FR).
- [ ] Create the app record in App Store Connect (bundle id
      `com.julesseguin.ontheroad`).
- [ ] Paste metadata from `metadata/en-US` and `metadata/fr-FR`.
- [ ] Answer App Privacy as **Data Not Collected** (per `app_privacy.md`).
- [ ] Set category (Travel) and age rating (4+).
- [ ] Upload a build (`APPLE_TEAM_ID` is read from the env — see `.env.example`).
- [ ] Submit for review.
