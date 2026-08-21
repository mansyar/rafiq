# Implementation Plan — V1 Release

**Track:** `v1-release_20260821` · **Spec:** [./spec.md](./spec.md)

Sequencing rationale: hygiene first (low risk), then the two hardening
pillars (CSP, updater), then E2E — so the Phase 5 release cut ships against a
fully green, 3-OS blocking CI and a wired updater.

## Phase 1: Repo hygiene & licensing `[checkpoint: 96e9b87]`

- [x] Task: Add dual MIT/Apache-2.0 license (`127508a`)
  - [x] Create `LICENSE` (full MIT + Apache-2.0 text, "Copyright (c) 2026 Rafiq contributors")
  - [x] Set `license = "MIT OR Apache-2.0"` in `src-tauri/Cargo.toml`
  - Verify: `cargo metadata` shows license field; file exists at repo root
- [x] Task: Remove dead placeholder page (`a355c78`)
  - [x] Delete `src/pages/placeholder.tsx` (unreferenced by any route)
  - Verify: `pnpm check` + `tsc --noEmit` + `pnpm test` all pass
- [x] Task: Remove test prayer trigger from Settings UI (`96d83a8`)
  - [x] Remove section + orphaned imports/state (Rust `trigger_test_prayer` + e2e helpers that call it stay)
  - [x] Adjust vitest expectations if any reference the section (none did)
  - Verify: Settings renders without the section; `pnpm test` green
- [x] Task: i18n On/Off toggle labels (`96e9b87`)
  - [x] Add EN + ID catalog keys for the toggle labels
  - [x] Use in Settings toggles
  - Verify: recursive EN/ID key parity passes (227 = 227, zero missing); labels render in both locales
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Strict CSP for release builds [checkpoint: 842b1c8]

- [x] Task: Add release build config with strict CSP (`842b1c8`)
  - [x] Create `src-tauri/tauri.release.json` with the strict policy (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: http://asset.localhost data:; media-src 'self' asset: http://asset.localhost; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'`); base config keeps `csp: null` for dev
  - [x] Validate config merge is valid (`tauri build --config` schema check) — full local release build with the merge config compiled and produced msi + nsis bundles
- [x] Task: Document release-CSP smoke checklist (`1982a8c`)
  - [x] Write smoke pass (boot, prayer times, Quran reader, cached recitation playback via asset protocol, settings) to run during Phase 5 release-build verification → `release-smoke-checklist.md` in this track folder
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Auto-updater (minisign) [checkpoint: ed0f569]

- [x] Task: Generate minisign keypair + updater config (`9220197`)
  - [x] Generate keypair (Tauri signer); public key into `tauri.conf.json` `plugins.updater` with GitHub Releases endpoint
  - [x] **User action:** add private key to GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY`
- [x] Task: Wire `tauri-plugin-updater` in Rust core (`376a786`)
  - [x] Cargo dependency + plugin registration in `lib.rs`
  - Verify: `cargo test` / `clippy` / `fmt` green
- [x] Task: Update-check logic (frontend, TDD) (`b1d1a94`)
  - [x] **Red:** vitest for new `src/lib/update.ts` — 24h min interval persistence (settings), status transitions (checking / update-available / latest / error), silent offline handling
  - [x] **Green:** implement to pass
  - Verify: new tests green; module coverage >80%
- [x] Task: Update UI (banner + settings row, i18n) (`6c55999`)
  - [x] `UpdateBanner` component — calm card, "restart to update" one-click (download + restart)
  - [x] Settings "Check for updates" row with localized status text
  - [x] EN + ID keys; parity check passes
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: E2E hardening — 3-OS blocking matrix [checkpoint: 538addd]

- [x] Task: 3-OS matrix + blocking e2e CI (431407e, ad225d0)
  - [x] `e2e.yml`: `os: [windows-latest, macos-latest, ubuntu-latest]`; remove `continue-on-error: true` and `TODO(matrix)`
  - [x] Verify: CI job runs green on all 3 OSes (run 32518558828 SUCCESS; Linux env-test race fixed in 0490ab3)
- [x] Task: `e2e/settings.spec.ts` (ed58015)
  - [x] Language switch EN→ID re-renders UI; method switch updates prayer times; notification + adhan toggles persist across reload; city search → select → resolved location updates
- [x] Task: `e2e/recitation.spec.ts` (b521f69)
  - [x] Play Al-Fatiha 1:1 (fixture, `TAURI_E2E=1`) → completes → cached in audio index → replay with network blocked works
- [x] Task: `e2e/adhan.spec.ts` (bc7caae)
  - [x] `trigger_test_prayer` → adhan player activates; notification fires when enabled
- [x] Task: `E2E_REAL_CDN` opt-in + docs (538addd)
  - [x] Env gate: real CDN download + playback instead of fixture
  - [x] Document in `e2e/README.md`; one real CDN run as manual gate (2/2 green, 14.9s)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — note on 538addd

## Phase 5: Release pipeline & docs

- [x] Task: `CHANGELOG.md` (Keep a Changelog) with rc.1 + v1.0.0 entries (ba52460)
- [x] Task: README **Download** + **License** sections (honest unsigned caveats) (965bdc5)
- [x] Task: `.github/workflows/release.yml` (c3363de)
  - [x] On `v*` tag: `tauri-apps/tauri-action` on windows/macos/ubuntu, unsigned, `createUpdaterArtifacts` with signing secret, release notes from CHANGELOG section
- [~] Task: Cut **v1.0.0-rc.1** (bump `1.0.0-rc.1` in `tauri.conf.json` + `package.json`, tag, push)
  - Verify: GitHub Release with Win/macOS/Linux artifacts + updater JSON
- [ ] Task: rc.1 real-machine verification
  - [ ] Boot on real machine, note SmartScreen/Gatekeeper behavior, cached playback, release-CSP smoke pass (Phase 2 checklist), updater status check
  - [ ] Fix any issues found
- [ ] Task: Cut **v1.0.0** (bump `1.0.0`, tag, push)
  - Verify: release artifacts published; rc.1 app on real machine prompts update to v1.0.0 (AC-6)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
