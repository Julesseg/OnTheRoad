# Ad-hoc builds are published per-PR to a rolling `build-history` branch, with ntfy notifications

## Status

accepted

## Context

The Release workflow ad-hoc-signs an `.ipa` on a self-hosted macOS runner and
serves it over-the-air from GitHub Pages (an `itms-services://` manifest the user
opens in Safari on their iPhone). The original design published only the **single
latest** build: every run rebuilt the whole Pages site into `/tmp/pages` and the
`deploy-pages` action replaced the entire site, so each deploy wiped the previous
build's folder. A single global `concurrency` group with `cancel-in-progress`
enforced "newest wins" — which also meant a new PR's run **cancelled any other
PR's in-flight build**.

Two things were wanted: a way to keep the last few builds around (to fall back to,
or compare a PR against its predecessors) with enough description to tell them
apart, and a notification when a build finishes — success or failure — with a
tappable link.

## Decision

**Distribution surface — a rolling `build-history` branch, not GitHub Releases.**
A dedicated `build-history` branch is the source of truth for what's published.
Each run fetches it, mutates it, and **force-pushes it back as a single rolling
commit** (no accumulating history), then uploads its contents as the Pages
artifact and deploys via the existing `deploy-pages` flow. This keeps the install
URLs and the OTA mechanism unchanged and needs **no repo Pages-settings change**.
Releases were rejected: OTA `itms-services` install from release-asset URLs is
fiddly, and Releases are heavier than warranted for a personal app. Force-pushing
a single commit keeps the tens-of-MB `.ipa` blobs from bloating git history — the
branch is a derived store, not a record.

**Retention is per-PR, keeping the 5 most recently built PRs.** A build folder is
keyed by PR number (`builds/pr-<n>/`), not commit SHA, so a new push to a PR
**overwrites that PR's slot** rather than adding a folder. A `builds.json` manifest
(`{pr, title, sha, time}` per slot, newest first) drives pruning to 5 and
regeneration of the root listing page and each slot's own install page. The PR
title is the human label; short SHA + build time disambiguate which commit/when.

**Concurrency is split in two**, because the original single knob conflated
"supersede an older build of the same PR" with "don't let two publishes race":

- Workflow-level `group: release-pr-${{ pr.number }}`, `cancel-in-progress: true`
  — a new push to a PR cancels only that PR's older run; different PRs run in
  parallel and never cancel each other.
- The publish/deploy job carries its own `group: build-history-publish`,
  `cancel-in-progress: false` — the read-modify-write of the shared branch and the
  Pages deploy are globally serialized and **queue rather than cancel**. Putting
  the branch mutation inside this serialized job makes it correct regardless of how
  many self-hosted runners exist.

**Notifications go through ntfy.sh.** A final `notify` job (`if: always()`,
`needs: [build, deploy]`) POSTs to a topic held in the `NTFY_TOPIC` secret (not
hardcoded, since the repo is public). Success links to the just-built PR's install
page; failure links to the Actions run logs.

## Consequences

- The branch is force-pushed every run; never base other work on it, and never
  treat its git log as history.
- With per-PR concurrency the global serialization that the old single group gave
  Pages deploys now lives only on the publish job — anything that mutates the
  branch or deploys Pages **must** run inside that job (or share its group).
- Two manual setup steps the workflow can't do: add the `NTFY_TOPIC` repo secret,
  and install the ntfy iOS app subscribed to that topic.
- This is release infrastructure, not app domain — it is recorded here, not in
  `CONTEXT.md`.
