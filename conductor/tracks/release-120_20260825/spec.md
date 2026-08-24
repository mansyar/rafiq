# Track Spec - Release 1.2.0 (`release-120_20260825`)

## Overview

Rafiq is at **v1.1.0** (published 2026-08-22). Since then, the archived track
`ux-resilience_20260825` delivered a complete batch of error-resilience work -
shared retryable error states, double-submit guards, sticky update-failure UI,
and i18n parity tests - currently sitting in `[Unreleased]`. This track cuts
**v1.2.0**: version bump, CHANGELOG finalization, tag + publish via the proven
release pipeline, and end-to-end verification (CI green on 3 OSes, real-machine
updater check 1.1.0 -> 1.2.0).

**Locked decisions:** version **1.2.0** (minor per semver - the batch contains
an "Added" section) · **unsigned** builds (signing deferred to its own track
once certificates exist) · **full verification** (pipeline + real-machine
updater flow + release smoke pass).

## Functional Requirements

### FR-1. Version bump (1.1.0 -> 1.2.0)

- **FR-1.1:** Bump `package.json` + `tauri.conf.json` + `Cargo.toml` to
  `1.2.0` (all three must stay in sync - Cargo.toml drift was a review finding
  on the v1-release track).
- **FR-1.2:** Verify consistency (`pnpm check`, `cargo fmt`/`clippy`/`test`,
  vitest all green).

### FR-2. CHANGELOG finalization

- **FR-2.1:** Move the `[Unreleased]` section to `[1.2.0] - 2026-08-25`
  (Keep a Changelog format, no rewording of entries).
- **FR-2.2:** Release notes for the GitHub Release are pulled from this
  section.

### FR-3. Pre-release verification

- **FR-3.1:** `ci.yml` + `e2e.yml` green on windows/macos/ubuntu (blocking
  matrix) before any tag is cut.
- **FR-3.2:** Refresh `release-smoke-checklist.md` for 1.2.0 - the checklist
  gains error-resilience steps (retryable states, double-submit guards) since
  those are the headline changes of this release.
- **FR-3.3:** Local release build (`pnpm tauri build --config
  src-tauri/tauri.release.json`) + smoke pass against the checklist.

### FR-4. Cut & publish v1.2.0

- **FR-4.1:** Tag `v1.2.0`, push -> `.github/workflows/release.yml`
  (tauri-action, unsigned, `createUpdaterArtifacts` with minisign signing).
- **FR-4.2:** Verify GitHub Release published: Windows NSIS, macOS dmg,
  Linux AppImage/deb/rpm + `latest.json` with signed per-platform entries,
  release notes from the CHANGELOG section.

### FR-5. Real-machine verification

- **FR-5.1:** On a real machine with v1.1.0 installed: in-app update flow to
  v1.2.0 - silent daily check -> banner -> one-click download -> install ->
  relaunch; document the new "Try again" retry path for install failures
  (from the resilience batch).
- **FR-5.2:** Release-build smoke pass (FR-3.2 checklist) on the real
  machine, including offline behavior (updater check degrades silently).

## Non-Functional Requirements

- **NFR-1:** No feature code changes in this track - the resilience batch is
  already shipped and archived; this track is versioning + distribution only.
- **NFR-2:** i18n parity untouched (no new catalog keys).
- **NFR-3:** Offline-first preserved - the updater never breaks offline use.
- **NFR-4:** Coverage baseline maintained (no new logic -> no coverage delta).

## Acceptance Criteria

- **AC-1:** All three version files at `1.2.0`, consistent with each other.
- **AC-2:** CHANGELOG has a dated `[1.2.0]` section; `[Unreleased]` empty.
- **AC-3:** `ci.yml` + `e2e.yml` green on all 3 OSes at the release commit.
- **AC-4:** GitHub Release `v1.2.0` live with Win/macOS/Linux artifacts +
  signed `latest.json`, release notes from the CHANGELOG.
- **AC-5:** Real-machine updater flow 1.1.0 -> 1.2.0 verified and documented
  (in-app, signed download, relaunch); smoke checklist pass documented.
- **AC-6:** README unsigned-build caveats remain accurate (no changes needed).

## Out of Scope

- Code signing / notarization (deferred - separate track).
- Any new features, fixes, or i18n changes.
- Changes to the release pipeline itself (it is proven; only executed here).