# Implementation Plan — Daily Ayah / Hadith

**Track:** `daily-ayah-hadith_20260821`
**Spec:** [./spec.md](./spec.md)
**Methodology:** strict TDD per `conductor/workflow.md` — each implementation
task is preceded by its failing-test task. Tests required only for
logic-bearing code (rotation engine, asset loader, commands); presentational
UI components exempt per project rule.

## Phase 1 — Content Curation & Asset Validation (Rust, TDD)

*Goal: bundle the Nawawi 40 hadiths + ~365 curated ayah references with
verified licensing and data integrity.*

- [x] Task: Verify content licensing *(spec FR-1.4)* [1889419]
  - [x] Verify Nawawi 40 Hadith Arabic (public domain) + chosen EN/ID
        translation sources are under verifiable permissive terms; record
        source + date in `src-tauri/assets/ATTRIBUTION.md`
- [x] Task: Author content assets [b556ba9]
  - [x] `src-tauri/assets/daily/hadiths.json` — 40 items: id, arabic, en, id_translation,
        source (narrator + "Nawawi 40 · Hadith N") — fixed duplicate "id" key: Indonesian translation stored as `id_translation`
  - [x] `src-tauri/assets/daily/ayahs.json` — ~365 curated entries: id,
        surah_id, ayah_number (references bundled Quran data; no duplicated
        Quran text) — replaced broken anchor-based CURATED list with deterministic uniform sampling (365/6236) validated against quran.json
- [ ] Task: Write failing tests for asset loading & validation *(Red)*
  - [ ] hadiths.json: exactly 40 items, unique ids, non-empty arabic/en/id
        fields
  - [ ] ayahs.json: unique (surah, ayah) refs, every ref resolves against the
        bundled Quran data, no duplicates within the cycle
- [ ] Task: Implement asset loader *(Green)*
  - [ ] Lazy `OnceLock` loader in `src-tauri/src/daily/` (mirrors the Quran
        asset-loader pattern)
  - [ ] `cargo test` → green; `clippy` clean
- [ ] Task: Refactor & verify coverage ≥80% for new module
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2 — Deterministic Rotation Engine & Command (Rust, TDD)

*Goal: date → item selection as a pure function, exposed via a Tauri
command.*

- [ ] Task: Write failing tests for rotation & command *(Red)*
  - [ ] Same date → same ayah + hadith; adjacent dates advance the index
  - [ ] Full-cycle coverage: 365 days → 365 distinct ayahs; 40 days → 40
        distinct hadiths (each item exactly once per cycle)
  - [ ] Epoch boundary (2026-01-01) + leap-year/February edge
  - [ ] `get_daily_content` response shape; local date used; ayah Arabic
        resolved from bundled Quran; translation follows `quran_translation`
        setting (default, override, invalid → fallback)
- [ ] Task: Implement rotation engine + command *(Green)*
  - [ ] Pure function: `days_since_2026_01_01(date) mod <collection length>`
        per collection *(spec FR-2.1)*
  - [ ] `get_daily_content` in `commands.rs` + registered in `lib.rs`; local
        date via `chrono::Local`
  - [ ] `cargo test` → green; `clippy` clean
- [ ] Task: Refactor & verify coverage ≥80%
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — Daily Reflection Card (Frontend)

*Goal: i18n, typed API wrapper, card UI on the Today page.*

- [ ] Task: Add `daily.*` i18n keys to `src/i18n/locales/en.json` + `id.json`
  - [ ] Card header, date label, ayah reference, hadith source line, "more"
        expansion, ARIA labels
- [ ] Task: Create `src/lib/daily.ts` — typed invoke wrapper + TanStack Query
      hook (invalidated on `quran_translation` change, mirroring the reader's
      pattern)
- [ ] Task: Build the Daily Reflection card + mount below today's prayer times
      on the Today page
  - [ ] Ayah block: surah name + reference, Arabic (RTL, Amiri, high-contrast),
        translation per active `quran_translation`; block links to
        `/quran/:surahId` *(spec FR-3.3)*
  - [ ] Hadith block: Arabic + active-locale translation + source line;
        line-clamp with "more" for long hadiths
  - [ ] Re-resolves on local date rollover (existing Today-page mechanism)
  - [ ] Gold/emerald tokens, ARIA labels, keyboard-operable link
- [ ] Task: Verify shell in dev
  - [ ] `pnpm tauri dev` renders the card; Biome + `tsc --noEmit` pass
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Integration Gate & Acceptance

*Goal: full quality gate + spec acceptance walk.*

- [ ] Task: Full local gate
  - [ ] `cargo fmt` + `clippy -D warnings` + `cargo test`; `pnpm check`
        (Biome) + `tsc --noEmit` + Vitest
  - [ ] Fix issues; commit
- [ ] Task: Acceptance criteria verification
  - [ ] Walk spec AC-1..AC-6; record results in plan notes
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
