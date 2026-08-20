# Implementation Plan — Prayer Log + Analytics

**Track:** Prayer Log + Analytics
**Spec:** [./spec.md](./spec.md)
**Date:** 2026-08-20

Method: strict TDD per `workflow.md` — each implementation task is preceded by
its failing-test task. Every phase ends with the Phase Verification &
Checkpointing Protocol.

## Phase 1: Storage — `prayer_log` table + repository

- [x] Task: Write failing tests for migration 2 (temp DB: migration applies, `schema_version` → 2, idempotent re-run, `prayer_log` table exists with `UNIQUE(log_date, prayer)`) [c99596e]
- [x] Task: Implement migration 2 in `storage/db.rs` (`MIGRATION_002`, bump `SCHEMA_VERSION` to 2) [fa36334]
- [x] Task: Write failing tests for the prayer-log repository (insert, duplicate `(date, prayer)` rejected, delete, range query ordering, empty range) [d495f3f]
- [x] Task: Implement repository in `src-tauri/src/log/mod.rs` (insert / delete / range query over rusqlite) [1aa4f25]
- [x] Task: Refactor + verify coverage ≥80% for the new module [1aa4f25]
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Classification + analytics (pure logic)

- [ ] Task: Write failing tests for prayer-window classification (fixtures: Fajr before/after sunrise, Dhuhr→Asr, Asr→Maghrib, Maghrib→Isha, Isha→next-day Fajr midnight crossing, exact window boundary, missing-location error)
- [ ] Task: Implement classification pure function (log_date, prayer, logged_at, that day's times + next-day Fajr for Isha → `on_time` | `qada`)
- [ ] Task: Write failing tests for streak computation (complete day, gap day breaks streak, today-complete vs today-incomplete, best streak across multiple gaps, empty history)
- [ ] Task: Implement streak computation (current + best over log entries)
- [ ] Task: Write failing tests for monthly summary (mid-month completion %, on-time / qada / missed breakdown, empty month, month boundary)
- [ ] Task: Implement monthly summary computation
- [ ] Task: Refactor + verify coverage ≥80% for the log module
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Tauri commands

- [ ] Task: Write failing tests for commands (`log_prayer`: resolves location + method, computes windows, classifies, persists; no-location error. `delete_log_entry`. `get_prayer_log` range. `get_log_analytics` → streaks + monthly summary)
- [ ] Task: Implement commands in `commands.rs` + register in `lib.rs`
- [ ] Task: Verify coverage + clippy clean
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Notification "Prayed" action

- [ ] Task: Write failing tests for the notification action (action id + localized label; action event routes to `log_prayer` with the prayer payload; platform fallback leaves the plain notification unchanged)
- [ ] Task: Implement action in the scheduler notification + action-event handling that calls `log_prayer` (tap moment = `logged_at`)
- [ ] Task: Verify coverage + clippy clean
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5: Frontend — Log screen + i18n

_Presentational components are test-exempt per project rule; thin API wrappers
mirror the existing `lib/*.ts` pattern._

- [ ] Task: Frontend log API wrapper (`src/lib/log.ts`): types + invoke wrappers mirroring the Rust commands
- [ ] Task: Build the Log page (today-first): today's 5 prayers with one-tap log/delete + status; 7-day grid with tappable retroactive cells; streak card (current + best); current-month summary with on-time / qada / missed breakdown; empty state; no-location prompt
- [ ] Task: Replace the `/log` placeholder route in `App.tsx` with the Log page
- [ ] Task: i18n — all new strings under `log.*` in `en` + `id` catalogs
- [ ] Task: Run full gate (`cargo test` + clippy, Biome, `tsc --noEmit`, Vitest)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
