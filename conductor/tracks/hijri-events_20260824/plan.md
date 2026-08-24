# Implementation Plan — Hijri Events + Special Dates

**Track:** `hijri-events_20260824`
**Spec:** [./spec.md](./spec.md)
**Date:** 2026-08-24

Methodology: strict TDD per `conductor/workflow.md` — failing-test task
precedes every implementation task. Tests required only for logic-bearing code
(assets, resolution engine, commands); presentational UI exempt per project
rule. Each phase ends with the Phase Verification & Checkpointing Protocol.

## Phase 1 — Event data assets & validation (Rust, TDD) [checkpoint: ea88244]

- [x] Task: Author content assets [4ad62c8]
  - [x] `src-tauri/assets/hijri-events/events.json` — exactly 8 events:
        stable `id`, `hijri_month`, `hijri_day`, `estimated` flag (Laylat
        al-Qadr only)
  - [x] `src-tauri/assets/hijri-events/content.json` — per-event thematic
        pair: ayah ref (`surah_id`, `ayah_number`) + hadith (`arabic`, `en`,
        `id_translation`, `source`)
- [x] Task: Verify licensing for override content; record sources + date in
      `src-tauri/assets/ATTRIBUTION.md` [4ad62c8]
- [x] Task: Write failing tests for asset loading & validation *(Red)* [346c5a2]
  - [x] Exactly 8 events; unique ids; `hijri_month` 1–12 / `hijri_day` 1–30
        ranges
  - [x] Every content ayah ref resolves against bundled Quran data; no
        duplicated Quran text
  - [x] Hadith fields non-empty; every event id has a content entry
- [x] Task: Implement loader module `src-tauri/src/hijri_events/`
      (`include_str!` + `OnceLock`, mirroring `daily/` pattern) *(Green)* [ea88244]
- [x] Task: Refactor + verify coverage ≥80% for the new module
      (cargo llvm-cov: 86.24% line coverage on `hijri_events/mod.rs`; no
      refactor needed — minimal serde parsers)
- [ ] Task: Phase Verification & Checkpoint *(Refer to workflow.md)*

## Phase 2 — Resolution logic (pure functions, TDD) [checkpoint: e07a6ac]

- [x] Task: Write failing tests for event-for-date resolution *(Red)* [2f4901a]
  - [x] Verified anchor: 2026-06-16 → Islamic New Year (1 Muḥarram 1448);
        ordinary day → none
  - [x] Each of the 8 events resolves on sample dates across two Hijri years
- [x] Task: Write failing tests for upcoming-events computation *(Red)* [2f4901a]
  - [x] Today-is-event leads with `is_today`; next-3 crosses Gregorian month
        boundary; crosses Hijri year boundary; forward search bounded (~370
        days) and terminates
- [x] Task: Write failing tests for Daily Reflection override integration
      *(Red)* [2f4901a]
  - [x] Event day → `Some(event)`; adjacent days → `None`; non-event rotation
        byte-identical to pre-track behavior *(AC-4)*
- [x] Task: Implement pure resolution functions + additive extension of
      `daily_content_for_date` *(Green)* [e07a6ac]
- [x] Task: Refactor + verify coverage ≥80%
      (cargo llvm-cov: 89.47% lines / 92.11% functions / 91.23% branches on
      `hijri_events/mod.rs`; no refactor needed)
- [ ] Task: Phase Verification & Checkpoint *(Refer to workflow.md)*

## Phase 3 — Command surface (TDD)

- [ ] Task: Write failing tests for commands *(Red)*
  - [ ] `get_upcoming_hijri_events(limit)` impl; `MonthGrid` day entries carry
        `event_id`; `DailyContent` serializes the optional `event` field
- [ ] Task: Implement new command + extend `hijri_month_grid_impl` /
      daily-content response; register in the invoke handler *(Green)*
- [ ] Task: Refactor + verify coverage ≥80% for touched modules
- [ ] Task: Phase Verification & Checkpoint *(Refer to workflow.md)*

## Phase 4 — Frontend UI & i18n (en/id)

- [ ] Task: Add i18n catalog strings (en + id): 8 event names + one-line
      descriptions, strip labels, "Today:" prefix, "(estimated)" suffix
- [ ] Task: Today page "Upcoming observances" strip via
      `get_upcoming_hijri_events(3)` — name, description, Gregorian date;
      distinct Today-lead emphasis *(FR-3)*
- [ ] Task: Calendar gold-dot markers from extended `MonthGrid` — accessible
      tooltip on hover/focus/tap, estimated suffix, ±1-day footnote reuse
      *(FR-4)*
- [ ] Task: Daily Reflection card renders event label + themed pair when
      `event` is present *(FR-5)*
- [ ] Task: Phase Verification & Checkpoint *(Refer to workflow.md)*

## Phase 5 — E2E, docs & full gate

- [ ] Task: Extend browser mock with deterministic event/clock fixture
- [ ] Task: Create `e2e/hijri-events.spec.ts` covering AC-1…AC-3, AC-7
- [ ] Task: Sync docs — dated tech-stack note (asset dir + command additions)
- [ ] Task: Run full gate: `cargo test` + clippy · Biome · `tsc --noEmit` ·
      Vitest · Playwright suite
- [ ] Task: Phase Verification & Checkpoint *(Refer to workflow.md)*
