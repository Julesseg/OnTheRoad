# on-the-road

Personal React Native (Expo) road-trip itinerary app. iOS-only for v1. Local-first storage as JSON files. See `/Users/julesseguin/.claude/plans/let-s-get-back-to-floofy-pebble.md` for the current plan.

## Android port (in progress)

The Android port lives on the long-lived integration branch **`android-port`**,
not `main`. When implementing any Android-port issue (tracking [#170](https://github.com/Julesseg/OnTheRoad/issues/170);
sub-issues #171–#178), **branch from `android-port` and open your PR with
`android-port` as the base — never `main`.** Use `Closes #<n>` as usual; the
issues close when `android-port` finally merges to `main` as a single PR. Keep
`Closes main`-style language out of these PRs. Strategy and trade-offs:
[ADR-0015](docs/adr/0015-android-port-platform-native.md); step list and
definition of done: [docs/android-port-plan.md](docs/android-port-plan.md).

## Agent skills

### Issue tracker

Issues live in GitHub Issues at `Julesseg/OnTheRoad`, accessed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

When opening a PR that implements an issue, put a `Closes #<n>` line in the PR body so the issue auto-closes on merge. Use one keyword per issue (`Closes #7, closes #8` — not `Closes #7, #8`). Valid keywords: `close(s/d)`, `fix(es/ed)`, `resolve(s/d)`.

### Triage labels

Default canonical vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
