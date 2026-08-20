# Implementation Plan — Hijri Calendar

**Track:** `hijri-calendar_20260820` · **Spec:** [./spec.md](./spec.md)

## Phase 1 — Hijri Conversion Engine (Rust Core) [checkpoint: f66d10c]
- [x] Task: Document tech-stack change and add `icu_calendar` dependency — 5418d78
  - [x] Add `icu_calendar` (ICU4X) to `src-tauri/Cargo.toml`; verify `cargo build`
  - [x] Update `conductor/tech-stack.md`: dated note recording the ICU4X Umm al-Qura choice (Workflow Principle 2 — stack changes documented *before* implementation)
- [x] Task: Write failing tests for the conversion engine (Red Phase) — 5418d78
  - [x] Gregorian→Hijri anchors: 2026-06-16 → 1 Muharram 1448; 2026-06-18 → 3 Muharram 1448
  - [x] Hijri→Gregorian anchor: 1447-12-10 → 2026-05-27
  - [x] Round-trip test: `hijri_to_gregorian(gregorian_to_hijri(d)) == d` sampled across 1444–1450 AH
  - [x] Month-length test: every month returns 29 or 30 days per Umm al-Qura
  - [x] Month-grid builder tests: day count, per-day Gregorian date + weekday, `is_today` flag (pure function of a reference date)
  - [x] Run `cargo test` and confirm the new tests **fail** (Red)
- [x] Task: Implement conversion engine to pass tests (Green Phase) — f66d10c
  - [x] `src-tauri/src/hijri/mod.rs`: `HijriDate` / `GregorianDate` / `MonthGrid` types (serde)
  - [x] `gregorian_to_hijri` / `hijri_to_gregorian` via `icu_calendar` Umm al-Qura
  - [x] Month-grid builder; `today` resolved via `chrono::Local` in a thin wrapper over the pure function
  - [x] Run `cargo test` and confirm **pass** (Green) — 134 passed / 0 failed
- [x] Task: Refactor and verify coverage — f66d10c
  - [x] Refactor for clarity (behavior unchanged), rerun tests — no changes needed; code already minimal and clippy-clean
  - [x] Verify >80% coverage on the new `hijri` module — cargo llvm-cov: 97.56% regions / 98.41% lines
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — f66d10c

## Phase 2 — Tauri Command Layer [checkpoint: 1f079dd]
- [x] Task: Expose commands and register them — 1f079dd
  - [x] Add `hijri_from_gregorian`, `hijri_to_gregorian`, `hijri_month_grid`, `today_hijri` to `src-tauri/src/commands.rs` following the existing `*_impl` + wrapper pattern
  - [x] Register in `lib.rs` `invoke_handler`
  - [x] `cargo fmt`, `cargo clippy`, `cargo test` all pass — 134 passed / 0 failed, clippy clean
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — 1f079dd

## Phase 3 — Frontend: i18n, API Wrapper, Month View
- [ ] Task: Add `hijri` i18n keys to `src/i18n/locales/en.json` and `id.json`
  - [ ] `nav.calendar`, `page.calendar` title/subtitle
  - [ ] 12 Hijri month names per locale (EN: Rabi al-Awwal… / ID: Rabiul Awal, Jumadil Awal, Dzulqa'dah, Dzulhijjah…) + locale-independent Arabic-script set (محرم، صفر، ربيع الأول، …)
  - [ ] Weekday names, converter labels, ±1 day computed-date footnote
- [ ] Task: Create `src/lib/hijri.ts` — typed Tauri invoke wrappers for the four commands
- [ ] Task: Implement Calendar page and navigation
  - [ ] `src/pages/calendar.tsx`: month grid with Hijri day + Gregorian overlay, header with locale month name, Hijri year, and Arabic-script secondary line
  - [ ] Previous / Next month + Today button
  - [ ] Today's cell highlighted (gold accent); ±1 day footnote
  - [ ] Register route in `App.tsx` + nav item in `layout.tsx` (lucide `CalendarDays` icon)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Date Converter & Final Verification
- [ ] Task: Implement bidirectional date converter
  - [ ] Gregorian→Hijri and Hijri→Gregorian inputs reusing `src/lib/hijri.ts` (single conversion path)
  - [ ] ±1 day footnote; locale-correct month names in both directions
- [ ] Task: Final quality pass
  - [ ] Arabic header rendering (bidi-safe), EN/ID locale switch, grid accuracy spot-check vs anchors
  - [ ] Verify zero network activity for the feature (offline requirement)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

*Notes: Per the project rule, tests are required for logic-bearing code only —
the conversion engine (Rust) is fully TDD'd; the frontend components and thin
invoke wrappers are presentational and need no tests.*
