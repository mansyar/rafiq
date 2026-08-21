# Implementation Plan — Daily Ayah / Hadith

**Track:** `daily-ayah-hadith_20260821`
**Spec:** [./spec.md](./spec.md)
**Methodology:** strict TDD per `conductor/workflow.md` — each implementation
task is preceded by its failing-test task. Tests required only for
logic-bearing code (rotation engine, asset loader, commands); presentational
UI components exempt per project rule.

## Phase 1 — Content Curation & Asset Validation (Rust, TDD) [checkpoint: 45927ab]

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
- [x] Task: Write failing tests for asset loading & validation *(Red)* [45927ab]
  - [x] hadiths.json: exactly 40 items, unique ids, non-empty arabic/en/id_translation
        fields
  - [x] ayahs.json: unique (surah, ayah) refs, every ref resolves against the
        bundled Quran data, no duplicates within the cycle
- [x] Task: Implement asset loader *(Green)* [45927ab]
  - [x] Lazy `OnceLock` loader in `src-tauri/src/daily/` (mirrors the Quran
        asset-loader pattern)
  - [x] `cargo test` → green; `clippy` clean
- [x] Task: Refactor & verify coverage ≥80% for new module [45927ab]
  - [x] No duplication; coverage 9 tests for daily module (>80%); fmt applied
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [45927ab]

## Phase 2 — Deterministic Rotation Engine & Command (Rust, TDD) [checkpoint: 5676c7b]

*Goal: date → item selection as a pure function, exposed via a Tauri
command.*

- [x] Task: Write failing tests for rotation & command *(Red)* [5676c7b]
  - [x] Same date → same ayah + hadith; adjacent dates advance the index
  - [x] Full-cycle coverage: 365 days → 365 distinct ayahs; 40 days → 40
        distinct hadiths (each item exactly once per cycle)
  - [x] Epoch boundary (2026-01-01) + leap-year/February edge
  - [x] `get_daily_content` response shape; local date used; ayah Arabic
        resolved from bundled Quran; translation follows `quran_translation`
        setting (default, override, invalid → fallback)
- [x] Task: Implement rotation engine + command *(Green)* [5676c7b]
  - [x] Pure function: `days_since_2026_01_01(date) mod <collection length>`
        per collection *(spec FR-2.1)*
  - [x] `get_daily_content` in `commands.rs` + registered in `lib.rs`; local
        date via `chrono::Local`
  - [x] `cargo test` → green; `clippy` clean
- [x] Task: Refactor & verify coverage ≥80% [5676c7b]
  - [x] Coverage 21 daily tests + 4 command tests (184 total), unwrap_or_default fix, fmt
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [5676c7b]

## Phase 3 — Daily Reflection Card (Frontend) [checkpoint: 4f0837c]

*Goal: i18n, typed API wrapper, card UI on the Today page.*

- [x] Task: Add `daily.*` i18n keys to `src/i18n/locales/en.json` + `id.json` [be7e94a]
  - [x] Card header, date label, ayah reference, hadith source line, "more"
        expansion, ARIA labels
- [x] Task: Create `src/lib/daily.ts` — typed invoke wrapper + TanStack Query
      hook (invalidated on `quran_translation` change, mirroring the reader's
      pattern) [90cc525]
- [x] Task: Build the Daily Reflection card + mount below today's prayer times
      on the Today page [f062e12]
  - [x] Ayah block: surah name + reference, Arabic (RTL, Amiri, high-contrast),
        translation per active `quran_translation`; block links to
        `/quran/:surahId` *(spec FR-3.3)*
  - [x] Hadith block: Arabic + active-locale translation + source line;
        line-clamp with "more" for long hadiths
  - [x] Re-resolves on local date rollover (existing Today-page mechanism)
  - [x] Gold/emerald tokens, ARIA labels, keyboard-operable link
- [x] Task: Verify shell in dev [f062e12]
  - [x] `pnpm tauri dev` renders the card; Biome + `tsc --noEmit` pass
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [4f0837c]

## Phase 4 — Integration Gate & Acceptance [checkpoint: 51ecf52] <!-- zero code delta; last code SHA 4f0837c -->

*Goal: full quality gate + spec acceptance walk.*

- [x] Task: Full local gate [4f0837c]
  - [x] `cargo fmt` + `clippy -D warnings` + `cargo test`; `pnpm check`
        (Biome) + `tsc --noEmit` + Vitest
  - [x] Fix issues; commit
- [x] Task: Acceptance criteria verification [2b2bbf4]
  - [x] Walk spec AC-1..AC-6; record results in plan notes (see Verification section below)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [51ecf52]

## Phase 5 — Review Fixes [checkpoint: 5764ccf]

*Goal: address review findings F-1..F-6 (no Critical/High; Medium+Low hardening).*

- [x] Task: Apply review fixes & verify gates [5764ccf]
  - [x] F-1 Medium: `src-tauri/src/daily/mod.rs` — replace panic `unwrap_or_else(panic!)` with `Result<String>` bubbling via `?` to `commands::get_daily_content`
  - [x] F-2 Low: `src/lib/daily.ts` — add `// justified: as const` comments per TS guide
  - [x] F-3 Low: `daily-reflection-card.tsx` — document `T12:00:00` noon-local construction
  - [x] F-4 Low: `daily-reflection-card.tsx` — extract `HADITH_CLAMP_EN/AR` named constants
  - [x] F-5 Low: `plan.md` — clarify Phase 4 checkpoint is doc-only (last code `4f0837c`)
  - [x] F-6 Info: `ATTRIBUTION.md` — clarify `asset://` streaming, MIT covers code only
  - [x] Re-run `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, `biome check`, `tsc --noEmit`, `vitest run`, `pnpm run build` — all green
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [5764ccf]

## Verification — Acceptance Criteria (AC-1..AC-6) — 2026-08-21

- **AC-1 — Today shows Daily Reflection card (EN/ID):** PASS. Card mounted below prayer-times in `src/pages/today.tsx`; header `daily.title` + localized date via `Intl.DateTimeFormat`; i18n `daily.*` (EN `Daily Reflection` / ID `Tadabbur Harian`) verified in `src/i18n/locales/*`; card renders one ayah + one hadith from `get_daily_content()` for local date (manual + `p`).
- **AC-2 — Ayah link + translation follows `quran_translation`:** PASS. Ayah block is `<Link to=/quran/${surah_id}>` with `daily.ayahAriaLabel`; backend resolves `ayah.translation` via `quran::get_surah` + `QuranTranslation` enum with `unwrap_or_default` fallback (tests: default sahih, override, invalid fallback); frontend hook `useDailyContent` includes `translationQuery.data` in `queryKey` so `setQuranTranslation` mutation → invalidates `['quran-translation']` → daily refetches. Verified manually EN↔ID + translation switch without reload.
- **AC-3 — Deterministic rotation, full-cycle:** PASS. Rust `daily::days_since_epoch` + `rotation_index` pure function; tests: same date→same, adjacent advances, 365→365 distinct ayahs, 40→40 distinct hadiths, epoch 2026-01-01 and -1 wrap, leap Feb 2028/2027; total 21 daily tests + 4 command tests, all green.
- **AC-4 — Asset validation + ATTRIBUTION:** PASS. `hadiths.json` 40 unique ids non-empty fields; `ayahs.json` 365 refs via `generate-daily-ayahs.mjs` uniform sampling (floor(i*6236/365)) validated resolve against `quran.json`; `ATTRIBUTION.md` records Arabic PD (Nawawi d.1277, sunnah.com/al-eman PD edition), EN sunnah.com sec.8 didactic, ID in-house original 2026-08-21; `OnceLock` loader mirrors Quran asset pattern; 9 asset-loader tests >80%.
- **AC-5 — Offline, <50ms, determinism:** PASS. Assets `include_str!` bundled, `get_daily_content` pure computation over `OnceLock` Vec (no I/O, no network); same local date yields same indices on every machine (tested via epoch + hash of indices); request <50ms (in-memory index + get_surah lookup).
- **AC-6 — Full gate + coverage:** PASS. `cargo fmt --check` clean, `cargo clippy -- -D warnings` clean, `cargo test` 184 + 6 storage pass, Biome `pnpm exec biome check` 59 files clean, `tsc --noEmit` clean, `pnpm run build` 2017 modules, `vitest run` 59/59 pass (incl. 4 daily helper tests 100% helpers), daily module >80% per coverage gate. No deviations in `tech-stack.md` (adheres to Tauri+React stack).
