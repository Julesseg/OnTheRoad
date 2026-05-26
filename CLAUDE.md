# on-the-road

Personal React Native (Expo) road-trip itinerary app. iOS-only for v1. Local-first storage as JSON files. See `/Users/julesseguin/.claude/plans/let-s-get-back-to-floofy-pebble.md` for the current plan.

## Agent skills

### Issue tracker

Issues live in GitHub Issues at `Julesseg/OnTheRoad`, accessed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

When opening a PR that implements an issue, put a `Closes #<n>` line in the PR body so the issue auto-closes on merge. Use one keyword per issue (`Closes #7, closes #8` — not `Closes #7, #8`). Valid keywords: `close(s/d)`, `fix(es/ed)`, `resolve(s/d)`.

### Triage labels

Default canonical vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
