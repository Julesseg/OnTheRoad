# App Store review reply — v1.0 "additional information" request

Apple rejected the v1.0 submission asking for more context (no specific guideline
violation — a Guideline 2.1 information request). This file is the source-of-truth
answer to each of the seven points so the reply can be reviewed in version control
and pasted into **App Store Connect → App Review Information → Notes** (and into the
Resolution Center reply).

Two items can only be produced by the developer at submission time:

- **Item 1 — screen recording:** must be captured on a physical iPhone. A shot list
  is in [§1](#1-screen-recording-shot-list) below.
- **Item 2 — devices tested:** filled in from the developer's own testing
  ([§2](#2-devices-and-os-tested)).

Everything else is drawn from the codebase, `CONTEXT.md`, `PRIVACY.md`, and
`store/app_privacy.md`, and is accurate as of this build.

---

## TL;DR for the Notes field (paste this)

> OnTheRoad is a free, local-first road-trip itinerary planner for iPhone. There is
> **no account, login, or registration** — the app opens straight into its features,
> so no demo credentials are needed. There are **no in-app purchases or
> subscriptions**, and **no public/social user-generated content** (everything a user
> creates stays in private on-device storage and is never shared to other users).
>
> To review: launch the app → tap **+** to create a trip (give it a title and a start/end
> date) → open a day and tap **+** to add an item → in the item's location field, search
> for a place (this is the one optional network call — the Photon/komoot public geocoder)
> → save, then view the trip on the map (the blue-dot location permission is requested
> here and is optional). A cover-photo picker requests Photos access (also optional).
>
> External services: **Photon (komoot) geocoder** for place search, **Apple
> MapKit / MKDirections** (on-device) for the map and road routing, and a one-shot
> redirect lookup when a user shares a Google/Apple Maps link into the app. No
> authentication, payment, analytics, tracking, or AI services. App Privacy =
> **Data Not Collected**.
>
> The app behaves identically in all regions; the only regional variation is UI
> language (English, or French on French-language devices). Minimum iOS 26.0.

---

## 1. Screen recording (shot list)

*Record on a physical iPhone running the latest iOS, starting from the app launch.
The app has no account, paywall, or public UGC, so those flows do not exist — the
recording only needs to show the core flow and the two permission prompts.*

1. **Launch** the app from the Home Screen (show the icon tap and splash).
2. **Create a trip:** tap **+** on the Trips tab, enter a title and a start/end date,
   save. Show the generated day-by-day layout.
3. **Add an item to a day:** open a day, tap **+**, enter a name, pick a category
   (Activity / Place / Stay / Meal / Note).
4. **Location search (shows the Photon network call):** in the item's location field,
   type a place name, pick a result, confirm. Save the item.
5. **Map view + Location permission prompt:** open the trip map. When the
   "show your location on the trip map" prompt appears, **tap Allow** — show the blue
   dot and the road-following route between pins. Tap a day to focus/dim it.
6. **Cover photo + Photos permission prompt:** add a cover photo to a trip; when the
   Photos prompt appears, show granting it and the photo appearing on the trip card.
7. **Maps hand-off:** tap an address / a pin's Directions pill and show it opening in
   Apple Maps (and that Google Maps / Waze are selectable in settings).
8. *(Optional)* **Share Capture:** from Apple/Google Maps or Safari, use the share
   sheet → **Add to On the Road** → show the prefilled item editor.
9. *(Optional)* **Import / Export & appearance:** show exporting a trip to a JSON file
   and the light/dark appearance toggle.

There are **no** registration, login, account-deletion, purchase, subscription, App
Tracking Transparency, contacts, or camera prompts to record — the app uses none of
them.

## 2. Devices and OS tested

The v1.0 build was tested on the following physical devices before submission, all
running **iOS 26**:

- iPhone 17 Pro — iOS 26
- iPhone 16 / 16 Pro — iOS 26
- iPhone 15 / 15 Pro — iOS 26

The app is **iPhone-only** (`supportsTablet: false`) and its **minimum deployment
target is iOS 26.0**.

## 3. App purpose and target audience

**Purpose.** OnTheRoad is a calm, **local-first road-trip itinerary planner** for
iPhone. A user creates a **Trip** with a start and end date; the app lays out one
**Day** per calendar date and the user fills each day with ordered **Items** — a
place to visit, a stay, a meal, an activity, or a note. Located items become pins
joined into a **route that follows real roads**, viewable on a map.

**Problem it solves.** Planning a multi-day road trip usually means juggling notes
apps, spreadsheets, and a maps app. OnTheRoad keeps the whole day-by-day plan and its
map in one place, **works offline on the road**, and requires **no account or
sign-up**. Changing dates never loses planned stops (the Shift / Adjust date model is
lossless).

**Target audience.** Travelers planning and taking road trips by car — individuals,
couples, and families — who want a private, no-login planner that also works without
signal. Age rating **4+**; no objectionable or age-restricted content.

## 4. Setting up and accessing the main features

**No login or credentials are required.** The app has no accounts and no server; it
opens directly into its features. There is nothing to sign in to, so the demo-account
fields in App Store Connect are intentionally left blank.

Quick path to exercise every core feature:

1. **Create a trip** — Trips tab → **+** → enter a title and a start/end date → Save.
   One day per date is generated automatically.
2. **Add items** — open a day → **+** → enter a name, optionally a time, category,
   notes, and a checklist.
3. **Add a location** — in the item's location field, **search for a place** and pick a
   result (or paste a coordinate / maps link, or tap the map). This populates the pin.
4. **See the route** — open the trip map to see pins joined by road-following legs; tap
   a day to focus it. Tap an address/pin to open it in Apple Maps, Google Maps, or Waze.
5. **Upcoming tab** — spotlights the current/next trip and the next item due.
6. **Optional extras** — add a cover photo (Photos prompt), switch light/dark
   appearance, and **Export/Import** a trip as a JSON file.

**Sample file (optional).** Because Import accepts a standalone trip JSON validated
against the app's schema, a reviewer can populate a full trip instantly by importing a
sample `.json` file. A ready-to-import one lives at
[`store/sample/trip.json`](sample/trip.json) — a three-day "Pacific Coast Weekend" that
exercises every item category, map pins with a road-following route, an address-only
stop, and a checklist. It can be attached in App Store Connect; it is not required to
review the app, since trips are easy to create by hand.

## 5. External services, tools, and platforms

The app's core functionality is delivered almost entirely on-device. The only external
or platform services are:

| Service | Used for | Notes |
| --- | --- | --- |
| **Photon geocoder (komoot)** — `photon.komoot.io` | Place/address search in the Location Picker and best-effort geocoding | Public geocoding service (OpenStreetMap-based open data). **No API key, no account, no device/advertising identifier** — only the typed query and a generic client label. |
| **Apple MapKit / MKDirections** | Rendering the map and computing road-following routes between stops | **First-party iOS API, on-device.** No third-party host, no key. Covered by Apple's own privacy. |
| **Google/Apple Maps link redirect** | One-shot resolution of a shared maps link's coordinates (Share Capture) | Only when the user explicitly shares a maps link into the app; the app follows that link's own redirect to read coordinates. Nothing is stored. |
| **Apple Maps / Google Maps / Waze** (hand-off) | Opening an address for turn-by-turn navigation | The app hands off via URL scheme; the chosen app's own privacy applies once opened. |

There are **no** authentication services, **no** payment processors or billing SDKs,
**no** analytics / attribution / crash-reporting / advertising SDKs, and **no** AI or
LLM services called by the app.

> Note on the "AI" on-ramp: the app offers a copyable **Schema Prompt** the user can
> paste into an LLM of their own choosing to structure a trip, then bring the result
> back via Import. The app itself **makes no network call and runs no model** — the
> user carries the text across by hand. No AI service is integrated.

App Privacy nutrition label: **Data Not Collected** (no backend, no account, no
tracking; `NSPrivacyTracking = false`, empty `NSPrivacyCollectedDataTypes`).
Privacy policy: https://julesseg.github.io/OnTheRoad/privacy.html

## 6. Regional differences

**The app functions consistently across all regions.** There is no geo-gating, no
region-locked content, and no region-specific feature set. The only variation is
**UI language**: the interface follows the device's system language and is provided in
**French** on French-language devices and **English** everywhere else (English is the
fallback for all other languages). User content, place search (worldwide via Photon),
mapping, and routing behave the same in every region.

## 7. Highly regulated industry / protected third-party material

**Not applicable.** OnTheRoad is a personal travel-planning utility. It does **not**
operate in a regulated industry (no finance, health, gambling, etc.) and includes **no
protected or licensed third-party material** requiring authorization. Map rendering and
routing use Apple's first-party MapKit; place search uses the Photon service over
open OpenStreetMap-based data. No special credentials or licenses are required.

---

## Guideline-by-guideline confirmations (the "common issues" list)

- **2.1 Bugs/crashes** — tested on physical iPhones (see §2).
- **2.1 Accessing the app** — no accounts; no demo credentials needed (see §4).
- **2.3.3 Screenshots** — store screenshots show the app in real use (Trips list,
  homepage map, day-filtered route, import), not splash/login art
  (`store/screenshots/`).
- **3.1.2 Subscriptions** — **none.** The app has no in-app purchases or
  subscriptions, so subscription disclosure does not apply.
- **5.1.1 Purpose strings** — two optional permissions, each with a specific,
  example-bearing usage string:
  - Location (When In Use): *"Allow On the Road to show your location on the trip map."*
  - Photos: *"Allow On the Road to add a cover photo to your trips."*
  These are also localized into French. No other sensitive-data prompts are used (no
  ATT, contacts, camera, microphone, etc.).
