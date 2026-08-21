# Implementation Plan — V1 Release

**Track:** `v1-release_20260821` · **Spec:** [./spec.md](./spec.md)

Sequencing rationale: hygiene first (low risk), then the two hardening
pillars (CSP, updater), then E2E — so the Phase 5 release cut ships against a
fully green, 3-OS blocking CI and a wired updater.

## Phase 1: Repo hygiene & licensing

- [x] Task: Add dual MIT/Apache-2.0 license (`127508a`)
  - [x] Create `LICENSE` (full MIT + Apache-2.0 text, "Copyright (c) 2026 Rafiq contributors")
  - [x] Set `license = "MIT OR Apache-2.0"` in `src-tauri/Cargo.toml`
  - Verify: `cargo metadata` shows license field; file exists at repo root
- [ ] Task: Remove dead placeholder page
  - [ ] Delete `src/pages/placeholder.tsx` (unreferenced by any route)
  - Verify: `pnpm check` + `tsc --noEmit` + `pnpm test` all pass
- [ ] Task: Remove test prayer trigger from Settings UI
  - [ ] Remove section + orphaned imports/state (Rust `trigger_test_prayer` + e2e helpers that call it stay)
  - [ ] Adjust vitest expectations if any reference the section
  - Verify: Settings renders without the section; `pnpm test` green
- [ ] Task: i18n On/Off toggle labels
  - [ ] Add EN + ID catalog keys for the toggle labels
  - [ ] Use in Settings toggles
  - Verify: recursive EN/ID key parity passes; labels render in both locales
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Strict CSP for release builds

- [ ] Task: Add release build config with strict CSP
  - [ ] Create `src-tauri/tauri.release.json` with the strict policy (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: http://asset.localhost data:; media-src 'self' asset: http://asset.localhost; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'`); base config keeps `csp: null` for dev
  - [ ] Validate config merge is valid (`tauri build --config` schema check)
- [ ] Task: Document release-CSP smoke checklist
  - [ ] Write smoke pass (boot, prayer times, Quran reader, cached recitation playback via asset protocol, settings) to run during Phase 5 release-build verification
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Auto-updater (minisign)

- [ ] Task: Generate minisign keypair + updater config
  - [ ] Generate keypair (Tauri signer); public key into `tauri.conf.json` `plugins.updater` with GitHub Releases endpoint
  - [ ] **User action:** add private key to GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY`
- [ ] Task: Wire `tauri-plugin-updater` in Rust core
  - [ ] Cargo dependency + plugin registration in `lib.rs`
  - Verify: `cargo test` / `clippy` / `fmt` green
- [ ] Task: Update-check logic (frontend, TDD)
  - [ ] **Red:** vitest for new `src/lib/update.ts` — 24h min interval persistence (settings), status transitions (checking / update-available / latest / error), silent offline handling
  - [ ] **Green:** implement to pass
  - Verify: new tests green; module coverage >80%
- [ ] Task: Update UI (banner + settings row, i18n)
  - [ ] `UpdateBanner` component — calm card, "restart to update" one-click (download + restart)
  - [ ] Settings "Check for updates" row with localized status text
  - [ ] EN + ID keys; parity check passes
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: E2E hardening — 3-OS blocking matrix

- [ ] Task: 3-OS matrix + blocking e2e CI
  - [ ] `e2e.yml`: `os: [windows-latest, macos-latest, ubuntu-latest]`; remove `continue-on-error: true` and `TODO(matrix)`
  - Verify: CI job runs green on all 3 OSes
- [ ] Task: `e2e/settings.spec.ts`
  - [ ] Language switch EN→ID re-renders UI; method switch updates prayer times; notification + adhan toggles persist across reload; city search → select → resolved location updates
- [ ] Task: `e2e/recitation.spec.ts`
  - [ ] Play Al-Fatiha 1:1 (fixture, `TAURI_E2E=1`) → completes → cached in audio index → replay with network blocked works
- [ ] Task: `e2e/adhan.spec.ts`
  - [ ] `trigger_test_prayer` → adhan player activates; notification fires when enabled
- [ ] Task: `E2E_REAL_CDN` opt-in + docs
  - [ ] Env gate: real CDN download + playback instead of fixture
  - [ ] Document in `e2e/README.md`; one real CDN run as manual gate
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5: Release pipeline & docs

- [ ] Task: `CHANGELOG.md` (Keep a Changelog) with rc.1 + v1.0.0 entries
- [ ] Task: README **Download** + **License** sections (honest unsigned caveats)
- [ ] Task: `.github/workflows/release.yml`
  - [ ] On `v*` tag: `tauri-apps/tauri-action` on windows/macos/ubuntu, unsigned, `createUpdaterArtifacts` with signing secret, release notes from CHANGELOG section
- [ ] Task: Cut **v1.0.0-rc.1** (bump `1.0.0-rc.1` in `tauri.conf.json` + `package.json`, tag, push)
  - Verify: GitHub Release with Win/macOS/Linux artifacts + updater JSON
- [ ] Task: rc.1 real-machine verification
  - [ ] Boot on real machine, note SmartScreen/Gatekeeper behavior, cached playback, release-CSP smoke pass (Phase 2 checklist), updater status check
  - [ ] Fix any issues found
- [ ] Task: Cut **v1.0.0** (bump `1.0.0`, tag, push)
  - Verify: release artifacts published; rc.1 app on real machine prompts update to v1.0.0 (AC-6)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
