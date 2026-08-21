# Track Spec — V1 Release (`v1-release_20260821`)

## Overview

First public release of Rafiq: **v1.0.0-rc.1 → v1.0.0**. All V1 feature work
is complete (9 archived tracks), but the product is currently undistributable:
no LICENSE file, no release pipeline, no auto-updater, E2E safety net is
Windows-only and non-blocking, and dev scaffolding (test-prayer trigger)
remains in the production UI with hardcoded English. This track makes Rafiq
shippable.

**Locked decisions:** dual MIT/Apache-2.0 · rc.1-then-v1.0.0 versioning ·
unsigned first · updater via minisign · strict CSP at release build only ·
3-OS blocking E2E matrix · README + CHANGELOG.

## Functional Requirements

### FR-1. Licensing & repo hygiene

- **FR-1.1:** `LICENSE` at repo root — full dual MIT + Apache-2.0 text,
  "Copyright (c) 2026 Rafiq contributors".
- **FR-1.2:** `Cargo.toml` gets `license = "MIT OR Apache-2.0"`.
- **FR-1.3:** Delete dead file `src/pages/placeholder.tsx` (foundation
  leftover, no longer routed).

### FR-2. E2E hardening — 3-OS blocking matrix

- **FR-2.1:** `.github/workflows/e2e.yml`: matrix
  `os: [windows-latest, macos-latest, ubuntu-latest]`, remove
  `continue-on-error: true`, remove `TODO(matrix)`.
- **FR-2.2:** Same Vite + mocked-Tauri path (no `TAURI_E2E_NATIVE`) on all
  three OSes.
- **FR-2.3:** `E2E_REAL_CDN` opt-in: when set, recitation downloads from the
  real Islamic Network CDN instead of the fixture; documented in
  `e2e/README.md` as a manual/periodic verification, not part of the default
  matrix.
- **FR-2.4:** New `e2e/settings.spec.ts`: language switch EN→ID re-renders UI;
  method switch updates prayer times; notification + adhan toggles persist
  across reload; city search → select → resolved location updates.
- **FR-2.5:** New `e2e/recitation.spec.ts`: play Al-Fatiha 1:1 (fixture,
  `TAURI_E2E=1`) → completes → cached in audio index → network blocked →
  replay from cache works.
- **FR-2.6:** New `e2e/adhan.spec.ts`: `trigger_test_prayer` → adhan player
  activates → notification fired when enabled.

### FR-3. Production UI cleanup

- **FR-3.1:** Remove "Test prayer trigger" section from Settings (hardcoded
  English, Phase-4 dev tooling). Rust `trigger_test_prayer` command **stays**
  — the E2E harness depends on it.
- **FR-3.2:** i18n the Settings "On"/"Off" toggle labels (EN + ID catalog
  keys).

### FR-4. CSP — release builds only

- **FR-4.1:** Base `tauri.conf.json` keeps `csp: null` (dev frictionless).
  Release workflow builds with an extra config file (`tauri build --config …`)
  setting:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' asset: http://asset.localhost data:;
  media-src 'self' asset: http://asset.localhost;
  font-src 'self' data:; connect-src 'self';
  object-src 'none'; base-uri 'self'`
- **FR-4.2:** Verified under release CSP: app boots; prayer times, Quran,
  cached recitation playback (asset protocol), and settings all functional
  (documented smoke pass).

### FR-5. Auto-updater (minisign)

- **FR-5.1:** Add `tauri-plugin-updater`; `plugins.updater` config with GitHub
  Releases endpoint + public key.
- **FR-5.2:** Minisign keypair generated; public key in config, private key in
  Actions secret (`TAURI_SIGNING_PRIVATE_KEY`).
- **FR-5.3:** UX: silent check once per launch (24h min interval, persisted)
  → calm in-app banner "update available — restart to update" (one-click
  download + restart); manual "Check for updates" in Settings with localized
  status (up-to-date / available / error). No blocking dialogs; i18n EN + ID.
- **FR-5.4:** Offline: check degrades silently (no user-visible error).
- **FR-5.5:** Release workflow signs update artifacts
  (`createUpdaterArtifacts`).

### FR-6. Release pipeline & docs

- **FR-6.1:** `.github/workflows/release.yml`: on `v*` tag →
  `tauri-apps/tauri-action` for Windows (.msi/.exe), macOS (.dmg), Linux
  (AppImage/.deb), unsigned, + updater artifacts.
- **FR-6.2:** `CHANGELOG.md` (Keep a Changelog) seeded with rc.1 + v1.0.0
  entries; release notes pulled from the CHANGELOG section.
- **FR-6.3:** README: **Download** section (GitHub Releases, per-platform
  notes, honest unsigned caveats) + **License** section.
- **FR-6.4:** Version `0.1.0` → `1.0.0-rc.1` (both `tauri.conf.json` +
  `package.json`), then → `1.0.0` for the final cut.
- **FR-6.5:** Cut `v1.0.0-rc.1`, verify pipeline end-to-end (incl. real
  updater check rc.1→v1.0.0 on a real machine), fix, then cut `v1.0.0`.

## Non-Functional Requirements

- **NFR-1:** TDD per workflow.md for all code changes (red → green).
- **NFR-2:** `ci.yml` + `e2e.yml` fully green on all 3 OSes before any tag is
  cut.
- **NFR-3:** i18n parity maintained (EN/ID recursive key check; new keys in
  both catalogs).
- **NFR-4:** Offline-first preserved — updater never breaks offline use.
- **NFR-5:** Coverage ≥ current baseline (189 Rust / 101 Vitest / 8 E2E specs
  after this track).

## Acceptance Criteria

- **AC-1:** LICENSE (dual) present; README Download + License sections;
  CHANGELOG.md present.
- **AC-2:** E2E green on windows/macos/ubuntu in CI, blocking, no
  `continue-on-error`.
- **AC-3:** One `E2E_REAL_CDN=1` run verifies real CDN download + playback
  (documented in e2e/README.md).
- **AC-4:** No test-trigger section in Settings; On/Off localized; EN/ID
  parity passes.
- **AC-5:** Release-CSP build passes functional smoke pass (documented).
- **AC-6:** Updater verified rc.1 → v1.0.0 on a real machine: banner →
  one-click install → restart; offline check silent.
- **AC-7:** GitHub Releases contains `v1.0.0-rc.1` and `v1.0.0` with
  Win/macOS/Linux artifacts + updater JSON + CHANGELOG-derived notes.
- **AC-8:** `cargo test`, clippy, biome, `tsc`, vitest all pass; coverage ≥
  baseline.

## Out of Scope

- Code signing (Windows cert, macOS notarization, Linux GPG) — follow-up when
  certs are available.
- Feature follow-ups: log history browsing, Hijri events, special-date daily
  content.
- Autostart settings UI, locales beyond EN/ID, mobile.

## Risks / Notes

- Unsigned Windows → SmartScreen notice; macOS → Gatekeeper warning (both
  disclosed in README + release notes).
- CSP is release-only — cached-audio asset-protocol playback must be
  explicitly verified (media-src + `asset:`).
- First pipeline run may need iteration — that's exactly what the rc.1 exists
  for.
