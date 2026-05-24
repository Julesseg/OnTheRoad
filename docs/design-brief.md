# OnTheRoad — App Function & Structure (design brief base)

## What it is
**OnTheRoad** is a personal road-trip itinerary app. It's a single-user, local-first tool for planning and following multi-day road trips: you create a trip with a date range, and the app generates one entry per day, into which you add stops, lodging, activities, and notes. The goal is a calm, glanceable planner you can build beforehand and reference while actually on the road.

- **Platform:** iOS only (v1), built with React Native + Expo (Expo Router, file-based routing).
- **Audience:** a single owner — no accounts, login, sharing, or multi-user concerns.
- **Storage:** entirely on-device. Trips are JSON files on the local filesystem; there is no backend, network sync, or cloud.

## Core data model
- **Trip** — `title`, `startDate`, `endDate`, and an ordered list of **Days**. Created from a title + start/end date; one Day is auto-generated for every calendar date in the range.
- **Day** — a single `date`, optional free-text `notes`, and an ordered list of **Items**.
- **Item** — one of four types, each shown with a type label, a title, and supporting detail lines:
  - **Location** — name, optional address, time, notes (a place/stop to visit).
  - **Accommodation** — name, address, check-in / check-out times, confirmation number, notes.
  - **Activity** — name, time, duration, notes.
  - **Note** — free text.
- Items may eventually carry attachments (e.g., photos or documents).
- Detail text is automatically **linkified**: URLs become tappable links and phone numbers become tap-to-call.

A trip has one of three derived statuses based on today's date: **Upcoming**, **In progress**, or **Past**.

## Screen structure & navigation
The app uses a **bottom tab bar** with three tabs, plus pushed detail screens and modals.

**Tab 1 — Upcoming** (home)
- Surfaces the single most relevant trip: the one in progress today, otherwise the next one starting soonest. Past trips are excluded.
- Shows the trip title, its date range, and a status indicator (either "In progress" or a "In N days" countdown).
- Below that, a scrollable list of the trip's days; the current day is flagged "Today." Tapping a day opens Day Detail.
- Empty state when there are no upcoming trips, pointing the user to the Trips tab.

**Tab 2 — Trips** (library)
- Lists every trip the user has created, each as a card showing title, date range, and a status badge (Upcoming / In progress / Past).
- A "+" button opens the New Trip flow.
- Tapping a trip opens its Trip Detail screen. Empty state prompts creating a first trip.

**Tab 3 — Settings**
- Eventually houses app-level preferences and trip data management (exact contents to be decided).

**New Trip** (modal)
- Form with title, start date, and end date fields, with Cancel / Create actions. On create, days are generated for the full range and the trip is saved.

**Trip Detail** (pushed screen)
- Header with the trip title and a back action; shows the date range and the full list of days. Tapping a day opens Day Detail.

**Day Detail** (pushed screen)
- Header showing the day's date; lists every item for that day (Location / Accommodation / Activity / Note) with its details.
- Should eventually support the full lifecycle of items within a day — adding, editing, reordering, and removing them — so this is the primary working surface for building an itinerary.

## Platform feel
The app leans on iOS-native UI: Apple's native tab bar and **Liquid Glass** material effects for cards and controls. It should feel like a native iOS app, with light and dark appearance support.

---

## Design instructions
> _[Add your design direction here.]_
