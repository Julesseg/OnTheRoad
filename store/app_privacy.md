# App Privacy — App Store Connect answers

This is the source of truth for the **App Privacy ("nutrition label")** section
of the App Store listing, plus the supporting reasoning. The matching on-device
manifest is `ios/ontheroad/PrivacyInfo.xcprivacy`, and the user-facing policy is
[`PRIVACY.md`](../PRIVACY.md) (hosted at
https://julesseg.github.io/OnTheRoad/privacy.html).

## Bottom line: **Data Not Collected**

In App Store Connect → App Privacy, answer:

> **"Do you or your third-party partners collect data from this app?"** → **No**

This produces the **"Data Not Collected"** label. That is the accurate answer for
OnTheRoad:

- The app has **no backend, no account, and no database**. We operate no servers
  and store nothing of the user's off-device.
- All trips, photos, notes, and settings are saved as **files in the app's
  private storage on the device** (see the *Local-first storage* entry in
  `CONTEXT.md`).
- There are **no analytics, advertising, attribution, crash-reporting, or
  tracking SDKs** in the app. (Verified: the only outbound hosts in the source are
  `photon.komoot.io` and shared map-link redirects — see below.)
- `NSPrivacyTracking` is **false** and `NSPrivacyCollectedDataTypes` is **empty**
  in `PrivacyInfo.xcprivacy`.

Per Apple's definition, "collect" means transmitting data off the device in a way
that lets you or your partners access it beyond servicing the immediate request.
Nothing in the app does that.

## Why the network calls do not change the answer

The app reaches the network only in user-initiated moments, and none of them
constitute "collection" by us or a contracted partner:

| Touchpoint | What leaves the device | Why it isn't "collected" |
| --- | --- | --- |
| **Location search** (Location Picker) | The text typed into the search box, sent to `photon.komoot.io` (Photon, a public geocoder run by komoot) | Sent with **no** account, name, device ID, or advertising identifier — only the query text and a generic `X-Client` label. We don't receive, log, or retain it. komoot is an independent public service, not an SDK or contracted partner embedded in the app. |
| **Resolving a shared map link** (Share Capture) | A request to follow the redirect of a Google/Apple Maps link the user explicitly shared in, to read its coordinates | One-shot lookup of a link the user just handed to the app; nothing is stored by us. |
| **Map directions** (trip route) | Endpoint coordinates passed to Apple's on-device **MKDirections / MapKit** | First-party iOS API; covered by Apple's own privacy. No third-party host, no key. |
| **Photos permission** | Nothing leaves the device | The chosen cover photo is copied into app-local storage; never uploaded. |
| **Location permission (When In Use)** | Nothing leaves the device | Used only to draw the blue dot and center the map locally. |

If you prefer to be maximally conservative, Apple would also accept declaring
**"Search History"** (and/or coarse **"Location"**) under **App Functionality →
Not Linked to the User → not used for tracking**, to reflect that query text
leaves the device to a third party. We have chosen **Data Not Collected** because
the developer collects and retains nothing and the data is not linked to identity;
this also matches the shipped `PrivacyInfo.xcprivacy`. (Decision confirmed with the
app owner.)

## Tracking question

> **"Do you use data to track users?"** → **No.**

No data is shared with data brokers, no advertising/attribution networks are
present, and no identifiers are joined across apps or websites.

## Keep these in sync

If a future change adds an analytics/crash SDK, a backend, ad code, or a new
outbound host, update **all three** of:

1. this file and the App Store Connect answers,
2. `ios/ontheroad/PrivacyInfo.xcprivacy`,
3. `PRIVACY.md` + `site/privacy.html`.
