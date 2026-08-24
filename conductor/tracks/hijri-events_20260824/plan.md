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

## Phase 3 — Command surface (TDD) [checkpoint: 0e46821]

- [x] Task: Write failing tests for commands *(Red)* [77ac89c]
  - [x] `get_upcoming_hijri_events(limit)` impl; `MonthGrid` day entries carry
        `event_id`; `DailyContent` serializes the optional `event` field
        *(serialization itself already delivered at e07a6ac)*
- [x] Task: Implement new command + extend `hijri_month_grid_impl` /
      daily-content response; register in the invoke handler *(Green)* [0e46821]
- [x] Task: Refactor + verify coverage ≥80% for touched modules
      (cargo llvm-cov under `hijri daily` filter: hijri/mod.rs 94.83%,
      hijri_events 89.47%, daily 89.77%; no refactor needed)
- [x] Task: Phase Verification & Checkpoint *(Refer to workflow.md)*
      *(checkpoint report attached to 0e46821)*

## Phase 4 — Frontend UI & i18n (en/id) [checkpoint: 185570c]

- [x] Task: Add i18n catalog strings (en + id): 8 event names + one-line
      descriptions, strip labels, "Today:" prefix, "(estimated)" suffix
      [185570c]
- [x] Task: Today page "Upcoming observances" strip via
      `get_upcoming_hijri_events(3)` — name, description, Gregorian date;
      distinct Today-lead emphasis *(FR-3)* [185570c]
- [x] Task: Calendar gold-dot markers from extended `MonthGrid` — accessible
      tooltip on hover/focus/tap, estimated suffix, ±1-day footnote reuse
      *(FR-4)* [185570c]
      *(backend amendment: `estimated` added to `UpcomingEvent` and
      `GridDay.event_estimated` so the suffix is data-driven —
      Red 08bb4a8 → Green 605a13d, 236 lib tests passing)*
- [x] Task: Daily Reflection card renders event label + themed pair when
      `event` is present *(FR-5)* [185570c]
- [ ] Task: Phase Verification & Checkpoint *(Refer to workflow.md)*

## Phase 5 — E2E, docs & full gate [checkpoint: 1a1c4a1]

- [x] Task: Extend browser mock with deterministic event/clock fixture
      [1a1c4a1] *(mock reads real bundled `hijri-events` assets; fixed two
      latent mock-engine bugs — naive +30 Gregorian carry and the
      month-boundary-swallowing Hijri normalization loop)*
- [x] Task: Create `e2e/hijri-events.spec.ts` covering AC-1…AC-3, AC-7
      [1a1c4a1] *(7 tests; all passing; calendar.spec regression-checked)*
- [x] Task: Sync docs — dated tech-stack note (asset dir + command additions)
      [82f7e87]
- [x] Task: Run full gate: `cargo test` + clippy · Biome · `tsc --noEmit` ·
      Vitest · Playwright suite *(236 lib + 6 integration · clippy -D warnings
      clean · Biome clean (one pre-existing warning in recitation.spec.ts,
      non-blocking, file untouched by this track) · tsc clean · Vitest 209/209 ·
      Playwright 41/41 chromium)*
- [x] Task: Phase Verification & Checkpoint *(Refer to workflow.md)*
      *(checkpoint report attached to 1a1c4a1)*
