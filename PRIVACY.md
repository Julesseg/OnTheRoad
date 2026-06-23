# Privacy Policy — OnTheRoad

**Effective date:** 23 June 2026

OnTheRoad ("the app") is a personal road-trip itinerary planner for iOS. It is
built to be **local-first**: your trips live on your device, not on our servers.
This policy explains what that means in practice and the few moments the app
talks to the network.

## The short version

- **We don't have a server, an account system, or a database.** There is nothing
  to sign up for and nothing of yours stored off your device by us.
- **We don't collect, sell, or share your personal data**, and we don't run
  analytics, advertising, or tracking of any kind.
- **Your trips, photos, and notes stay on your iPhone**, saved as files inside
  the app's private storage. They are included in your encrypted iPhone/iCloud
  device backups (controlled by you in iOS Settings), and nowhere else.

## What stays on your device

Everything you create in the app is stored locally as files in the app's private
document directory:

- Your trips, days, and items (places, stays, meals, activities, notes).
- Item details such as times, addresses, coordinates, checklists, and notes.
- A cover photo ("wallpaper") you optionally add to a trip — copied into the
  app's storage so it survives even if you later delete the original.
- App settings (preferred maps app, appearance).

We never transmit these to us or to anyone else. You can export a trip as a JSON
file and share it yourself; that is an action you take deliberately, to a
destination you choose.

## When the app uses the network

The app works offline. It reaches the network only at these moments, each one
started by you, and none of them are tied to your identity:

1. **Location search.** When you search for a place while adding or editing an
   item's location, the text you type is sent to **Photon**, a public geocoding
   service operated by komoot (`photon.komoot.io`), to return matching places and
   coordinates. The query is sent without any account, name, device identifier,
   or advertising ID — only the search text and a generic client label. We do not
   log or store these queries; komoot's handling is governed by komoot's own
   privacy practices.
2. **Resolving a shared map link.** When you share a Google Maps or Apple Maps
   link into the app (via the iOS share sheet), the app may follow that link's
   redirect to read the coordinates it points to. This contacts the link's own
   host (e.g. Google) only for that lookup.
3. **Map directions.** Road-following routes between your stops are drawn using
   Apple's on-device **MapKit / MKDirections**. This is provided by iOS itself and
   is covered by [Apple's privacy policy](https://www.apple.com/legal/privacy/).

If you are offline, search and link-resolution simply fall back gracefully (for
example, an item is saved with its address but without a map pin).

## Permissions the app may request

- **Photos** — only when you choose to add a cover photo to a trip. The selected
  image is copied into the app's local storage and is never uploaded.
- **Location (While Using the App)** — only to show your current position as the
  blue dot on the map and to center the map on you. Your location stays on the
  device; it is not collected or transmitted by us.

You can grant or revoke either permission at any time in **iOS Settings →
OnTheRoad**.

## Opening other apps

When you tap an address to navigate, the app hands off to your chosen maps app —
**Apple Maps**, **Google Maps**, or **Waze**. Once you leave OnTheRoad, that
app's own privacy policy applies.

## Children's privacy

The app is not directed at children and collects no personal information from
anyone, including children under 13.

## Changes to this policy

If this policy changes, the updated version will be posted at this URL with a new
effective date.

## Contact

Questions about this policy can be sent to **julessseguin@gmail.com**.
