# Implementation Plan — quran-reader_20260820

**Track:** Quran Reader
**Type:** Feature
**Methodology:** TDD per `conductor/workflow.md`; tests required only for logic-bearing code (project rule: storage/search/commands — presentational components exempt).

## Phase 1 — Content Pipeline & Data Foundation (Rust, TDD)

*Goal: bundled Uthmani + 3 translations as offline assets with validation.*

- [ ] Task 1.1: Acquire & curate Quran datasets (Red)
  - [ ] Source Tanzil Uthmani Arabic + Sahih International, The Clear Quran, Kemenag JSON (license-verified, ATTRIBUTION)
  - [ ] Generate `src-tauri/assets/quran/` (surah metadata + ayahs) + `ATTRIBUTION.md`
  - [ ] Validation test: 114 surahs, ayah counts, Uthmani non-empty, translations aligned, unique ids
- [ ] Task 1.2: Implement asset loader (Green)
  - [ ] Lazy-load via `OnceLock<Vec<Surah>>/Ayah>`, typed `Surah/Ayah/Quran` structs
  - [ ] Tests green; `clippy` clean
- [ ] Task: Phase Verification & Checkpoint (per `workflow.md`)

## Phase 2 — Quran Commands & Search (Rust, TDD)

*Goal: Tauri commands for surah list/get, search, translation setting.*

- [ ] Task 2.1: Failing tests for store + resolution (Red)
  - [ ] `list_surahs`, `get_surah(id)` returns Arabic + ayahs, invalid id error
  - [ ] `search_surahs` case-insensitive EN/ID/AR + number, ranked top-N
  - [ ] `quran_translation` setting persist via `SettingsRepo` (single active)
- [ ] Task 2.2: Implement commands (Green)
  - [ ] Indexed search (score EN exact/prefix/contains + number), `get_surah` with Bismillah handling
  - [ ] Expose `list_surahs/get_surah/search_surahs/get_quran_translation/set_quran_translation` in `commands.rs`/`lib.rs`
  - [ ] Tests green; `clippy` clean
- [ ] Task: Phase Verification & Checkpoint (per `workflow.md`)

## Phase 3 — Reader UI (Frontend)

*Goal: Surah list + reader with side-by-side, translation switcher, search.*

- [ ] Task 3.1: Data layer + i18n
  - [ ] Add `src/lib/quran.ts` wrapping `invoke` (list/get/search, translation get/set)
  - [ ] `src/i18n/locales/en|id.json` keys `quran.*` (surah, ayah, bismillah, translation names)
  - [ ] Unit tests for any helpers (format, search ranking)
  - [ ] Bundle Amiri font, `index.css` sacred-text high-contrast tokens
- [ ] Task 3.2: Surah list page
  - [ ] Render 114 surahs Mushaf order, number + name EN/ID/AR, ayah count, search input debounced
  - [ ] Link to reader `/quran/:id`
- [ ] Task 3.3: Surah reader page
  - [ ] Fetch `get_surah`, render continuous ayahs: side-by-side columns (Arabic RTL + translation) desktop / stacked mobile
  - [ ] Bismillah header (except Al-Fatihah/Al-Tawbah handling per Tanzil), ayah numbers, translation switcher (persisted, invalidates query)
  - [ ] Gold/emerald reverent styling, ARIA labels
- [ ] Task 3.4: Verify shell
  - [ ] `pnpm tauri dev` renders list → reader; `biome` + `tsc --noEmit` pass
- [ ] Task: Phase Verification & Checkpoint (per `workflow.md`)

## Phase 4 — Integration Gate & Acceptance

*Goal: full gate + spec AC-1..8 walk.*

- [ ] Task 4.1: Full local gate
  - [ ] `cargo fmt` + `clippy -D warnings` + `cargo test`; `pnpm check` (Biome) + `tsc --noEmit` + Vitest; fix issues; commit
- [ ] Task 4.2: Acceptance criteria verification
  - [ ] Walk spec AC-1..AC-8; record results in plan notes
- [ ] Task: Phase Verification & Checkpoint (per `workflow.md`)
