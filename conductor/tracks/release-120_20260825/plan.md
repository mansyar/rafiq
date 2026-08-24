# Implementation Plan - Release 1.2.0

**Track:** `release-120_20260825` · **Spec:** [./spec.md](./spec.md)

Sequencing rationale: no feature code exists in this track - Phase 1 versions
the repo, Phase 2 proves CI + local release build before any tag, Phase 3 cuts
the release through the proven pipeline, Phase 4 verifies the real upgrade
path on a machine, Phase 5 closes docs and archives. TDD does not apply to new
logic (there is none); the full test suites run as regression gates (NFR-4).

## Phase 1: Version bump & CHANGELOG

- [x] Task: Bump version to 1.2.0 (all three files must stay in sync - Cargo.toml drift was a review finding on v1-release) (02758fa)
  - [x] `package.json`: `1.1.0` -> `1.2.0`
  - [x] `tauri.conf.json`: `1.1.0` -> `1.2.0`
  - [x] `Cargo.toml`: `1.1.0` -> `1.2.0`
  - Verify: grep confirms all three at `1.2.0`; no other version references left stale
- [x] Task: Finalize CHANGELOG (Keep a Changelog format) (7ddcf1e)
  - [x] Move `[Unreleased]` section to `[1.2.0] - 2026-08-25` (no rewording)
  - [x] Verify `[Unreleased]` is empty / removed
- [ ] Task: Regression gates
  - [ ] `pnpm check` (Biome lint + format)
  - [ ] `pnpm test` (Vitest suite green)
  - [ ] `cargo fmt --check` + `cargo clippy` + `cargo test`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Pre-release verification & smoke checklist

- [ ] Task: Confirm CI green before tagging
  - [ ] Latest `ci.yml` run green on windows/macos/ubuntu
  - [ ] Latest `e2e.yml` run green on windows/macos/ubuntu (blocking matrix)
- [ ] Task: Refresh `release-smoke-checklist.md` for 1.2.0
  - [ ] Add error-resilience steps: retryable states surface on failure, double-submit guards, updater "Try again" path
  - [ ] Keep release-CSP build instructions (`--config src-tauri/tauri.release.json`)
- [ ] Task: Local release build + smoke pass
  - [ ] `pnpm tauri build --config src-tauri/tauri.release.json`
  - [ ] Run smoke checklist against the release build; document results in the checklist file
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Cut & publish v1.2.0

- [ ] Task: Tag and push
  - [ ] `git tag v1.2.0` + push tag (triggers `.github/workflows/release.yml`)
- [ ] Task: Verify release pipeline
  - [ ] `release.yml` run green on windows/macos/ubuntu
  - [ ] GitHub Release `v1.2.0` live: Windows NSIS, macOS dmg, Linux AppImage/deb/rpm
  - [ ] Updater artifacts: `latest.json` with signed per-platform entries
  - [ ] Release notes pulled from the `[1.2.0]` CHANGELOG section
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Real-machine verification

- [ ] Task: Verify in-app updater flow 1.1.0 -> 1.2.0
  - [ ] Install v1.1.0 (or use existing install) on a real machine
  - [ ] Silent check -> update banner -> one-click download -> install -> relaunch -> app reports 1.2.0
  - [ ] Document result; note the install-failure "Try again" retry path (resilience batch behavior)
- [ ] Task: Release smoke pass on the real machine
  - [ ] Run the updated 1.2.0 checklist: error-resilience UI, cached recitation with network blocked, offline updater silence
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5: Docs & completion

- [ ] Task: Docs sync
  - [ ] CHANGELOG `[1.2.0]` final (date + entries correct)
  - [ ] README unsigned-build caveats remain accurate (no changes expected)
  - [ ] `tech-stack.md` dated note if anything material changed (expected: none)
- [ ] Task: Final gate & completion
  - [ ] Definition of Done: all checks green, docs complete, release verified
  - [ ] Mark track complete in plan, archive per project convention
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)