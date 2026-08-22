# Implementation Plan — Recitation Playback Upgrades

> Follows `conductor/workflow.md`: strict TDD (Red → Green → Refactor) for every
> logic-bearing task; tests required only for logic-bearing code (project rule);
> phase checkpoints attach verification reports as git notes.

## Phase 1 — Player state machine & preferences (pure logic, TDD)

All playback-mode semantics live in the pure `playerReducer`
(`src/lib/recitation.ts`) — DOM-free Vitest coverage first.

- [x] Task: Extend reducer/types with playback prefs (`speed`, `repeatMode`, `autoAdvance`) + defaults (46d59cb)
  - [ ] Write failing tests for initial/default pref state
  - [ ] Implement state fields + typed unions (`0.75|1|1.25|1.5|2`, `off|ayah|surah`, boolean)
- [x] Task: Implement repeat-ayah loop on `ended` (position stays put) — tests first (9eac9c2)
- [x] Task: Implement surah-repeat wrap + precedence rules (loop > repeat > advance) — tests first (296daef)
- [x] Task: Implement auto-advance transition event + hard stop at Surah 114 — tests first (d063a12)
- [x] Task: Preference persistence helpers over `get_setting`/`set_setting` with corrupt-value fallbacks — tests first (e532a10)
- [x] Task: Store actions `cycleSpeed` / `setRepeatMode` / `toggleAutoAdvance` writing through to settings — tests first (8f931cb)
- [x] Task: Verify coverage (>80% changed logic) & quality gates (biome, tsc) (6b0b20a)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2 — Transport UI & i18n

UI scaffolding per project rule needs no unit tests; verify i18n completeness
and accessibility manually + via existing patterns.

- [ ] Task: Speed cycle button in reader footer (label `1.25×`, aria-label, EN/ID keys)
- [ ] Task: Repeat segmented control + "Continue to next surah" toggle in footer (EN/ID keys)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — Auto-advance reader integration + E2E

- [ ] Task: Reader auto-navigation: view follows playback across the surah boundary without killing audio (revisit unmount/surah-switch effects in `RecitationAudio`)
- [ ] Task: Extend E2E mock (`e2e/helpers/mock-tauri.ts`) for multi-surah playback states + preference persistence
- [ ] Task: E2E specs: speed cycling, surah-repeat wrap, auto-advance navigation (AC-7)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Cache backend (Rust, TDD)

- [ ] Task: `RecitationRepo`: list-all + per-surah aggregation (sizes via existing `size_bytes`; group by quran metadata boundaries) — cargo tests first
- [ ] Task: `RecitationRepo`: delete-per-surah + delete-all removing rows **and** files; tolerate missing files — cargo tests first (temp-dir fixtures)
- [ ] Task: Tauri commands `get_recitation_cache_summary` / `delete_recitation_cache` (+ registration in `lib.rs`, command-level tests)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5 — Settings cache card & graceful teardown

- [ ] Task: Cache summary card in Settings (total size + per-surah rows, TanStack Query hook)
- [ ] Task: Delete actions: per-surah immediate, delete-all behind confirm dialog, empty-state, post-delete query invalidation
- [ ] Task: Stop playback gracefully when the playing file is deleted mid-playback
- [ ] Task: i18n completeness pass (EN/ID) + accessibility review of all new controls
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
