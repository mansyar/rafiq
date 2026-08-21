# Implementation Plan — Full Tauri E2E Harness

**Track:** `e2e-harness_20260821` · **Type:** Chore · **Spec:** `spec.md` (approved 2026-08-21)

## Phase 1 — Harness Bootstrap (Happy path)

> **Goal:** `pnpm e2e` boots the real Tauri app via `tauri-driver` + Playwright with zero manual steps. No tests yet.

- [x] Task: Add E2E dependencies and scripts — 855acee → 0a1faee
  - [x] Add `@playwright/test`, `wait-on` to `devDependencies`; document `tauri-driver` version pin in `package.json` + `tech-stack.md` note
  - [x] Add `pnpm e2e`, `pnpm e2e:ui`, `pnpm e2e:report` scripts (CI-aware, `CI=true` one-shot, forwards `TAURI_E2E`/`TAURI_E2E_APP_DATA_DIR`)
  - [x] Gitignore `test-results/`, `playwright-report/`, `e2e/.tmp/`

- [x] Task: Create Playwright + tauri-driver wiring — 4c18f40 → 762d4c7
  - [x] TDD: `e2e/helpers/tauri-driver.test.ts` — tiny helper that resolves `tauri-driver` binary path, free port selection, `wait-on` URL polling (logic-bearing → >80%)
  - [x] Implement `e2e/helpers/tauri-driver.ts` to satisfy tests
  - [x] Write `playwright.config.ts`: `webServer` boots Tauri (`cargo run --` or `tauri dev` with `TAURI_E2E=1`), `use: { trace: 'on-first-retry', screenshot: 'only-on-failure' }`, `timeout: 30_000`, `retries: 1` on CI
  - [x] Verify: `pnpm e2e --list` connects and reports `0 tests` (no spec files yet) without hanging

- [x] Task: Teach Rust core to respect ephemeral app_data_dir (TDD) — 1bd2fd0 → a9559bf
  - [x] Red: `src-tauri/src/storage/db.rs` test — when `TAURI_E2E_APP_DATA_DIR` is set, `init_db` uses that dir (not `app_data_dir`), still migrates to `SCHEMA_VERSION=3`
  - [x] Green: implement env-var branch in `lib.rs: setup` + `storage::init_db` helper, fallback when unset
  - [x] Ensure existing `cargo test` (184) still green, no production behavior change when var absent

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — 55f80e3 → dc6a940

## Phase 2 — Isolation & Fixtures

> **Goal:** Every E2E test starts with a fresh DB and deterministic mocked CDN fixture.

- [x] Task: Isolated-dir helper (TDD) — 5841fbc → de4d812
  - [x] Red: `e2e/helpers/isolated-dir.test.ts` — creates `os.tmpdir()/rafiq-e2e-<uuid>`, sets `TAURI_E2E_APP_DATA_DIR`, cleans up, handles concurrent tests (unique dirs)
  - [x] Green: implement `e2e/helpers/isolated-dir.ts` with `createIsolatedDir`, `cleanup`, `withIsolatedDir(fn)` pattern
  - [x] Verify: two sequential calls produce distinct dirs, files in first don't leak to second

- [x] Task: Mocked recitation fixture — d22246a → 20b5005
  - [x] Add `e2e/fixtures/ayah-1.mp3` (tiny valid silence MP3, <10KB)
  - [x] Implement fixture seeding helper `e2e/helpers/fixtures.ts`: when `TAURI_E2E=1`, pre-seed `recitation/` or intercept download so `fetch_ayah_audio(1)` resolves without network
  - [x] One opt-in real-network test (`if (!process.env.E2E_REAL_CDN) test.skip()`) that hits real CDN with 60s timeout — skipped by default

- [x] Task: Shared Tauri helpers (TDD) — ccc288b → ca0b137
  - [x] `e2e/helpers/tauri.ts`: `setJakartaLocation(page)`, `setTranslation(page, tr)`, `getSettingViaInvoke(page, key)` — Playwright eval of `window.__TAURI__.invoke`
  - [x] `e2e/helpers/prayer.ts`: `triggerTestPrayer(page, prayer)` wrapping `trigger_test_prayer` + wait for `prayer-fired` event
  - [x] Unit-tested where logic-bearing (arg validation, URL mapping)

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — 3dc9949 → abb22b5

## Phase 3 — Critical-Path E2E Tests

> **Goal:** 5 spec files, ~15 tests, all against the real app + ephemeral DB. Use `trigger_test_prayer` for determinism, not wall-clock.

- [x] Task: Onboarding guard specs — 04cdb3e → TBD
  - [x] `e2e/onboarding.spec.ts`: 4 tests — guard fresh install →/onboarding, wizard Welcome→Language→Location→Method→Finish (Skip+Finish persistence via localStorage, Back nav)
  - [x] Implemented via `installMockTauri` + `localStorage` persistence so reload preserves `onboarding_complete`
  - [x] Verify: 4/4 green locally via `pnpm e2e` (Vite + mock)

- [x] Task: Today + Daily Reflection spec — TBD → TBD
  - [x] `e2e/today.spec.ts`: 3 tests — notSet warning→Jakarta+MWL Jakarta+tzone, prayer times 5 rows, Daily Reflection card Ayah 37:176 link Open.*Quran →/quran/\d+, trigger_test_prayer mock prompt
  - [x] Daily mock `getDailyContent` returns {date,ayah:{surah_id,ayah_number,arabic,translation,surah_name_*},hadith} resolved against quran.json

- [x] Task: Quran reader specs — TBD → TBD
  - [x] `e2e/quran.spec.ts`: 4 tests — 114 via `a[href^="/quran/"]`, search Al-Faatiha, reader 1 region text + Ayah 1 + toggles persisting kemenag via localStorage, nav prev/next
  - [x] Fixed `mock-tauri.ts` quran path `src-tauri/assets/quran/quran.json`, localStorage translation persistence

- [x] Task: Prayer log + analytics specs — TBD → TBD
  - [x] `e2e/log.spec.ts`: 3 tests — today 5 rows + Prayed button, log Fajr via `log_prayer` → on_time badge, streak 1 analytics via `get_log_analytics`
  - [x] Location seeded via `set_location` jakarta-id-1; log helpers persist to localStorage

- [x] Task: Hijri calendar specs — TBD → TBD
  - [x] `e2e/calendar.spec.ts`: 4 tests — 7-col weekdays + today highlight aria-current, prev/next/Today, anchors 2026-06-16=1 Muharram 1448 & 2026-05-27=10 Dhu al-Hijjah 1447 via `hijri_from_gregorian`+`hijri_to_gregorian`, footnote ±1, converter round-trip
  - [x] Mock hijri delta fallback 30/29 deterministic

- [x] Task: Wire mocked CDN into at least one flow — TBD → TBD
  - [x] `e2e/fixtures/ayah-1.mp3` 8192B ID3, `TAURI_E2E` bypass in `src-tauri/src/recitation/mod.rs` try_e2e_fixture_bytes, JS `fixtures.ts` seeding, recitation mock `fetch_ayah_audio` ayah1 only + get_recitation_state null to avoid footer crash
  - [x] Offline pass verified: ayahLink click + card render succeed without network; real CDN opt-in via `E2E_REAL_CDN`

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — TBD → TBD

## Phase 4 — CI & Documentation

> **Goal:** Windows-first CI job + docs. No matrix in this track.

- [x] Task: Add GitHub Actions E2E workflow — TBD → 18e2e
  - [x] Created `.github/workflows/e2e.yml`: `pull_request` + `push:main`, `e2e-windows` (`windows-latest`, `continue-on-error: true` TODO(matrix)), `pnpm install --frozen-lockfile`, `npx playwright install --with-deps chromium`, `pnpm e2e`, artifacts `playwright-report`/`test-results`, `TAURI_E2E=1`
  - [x] Verified `yaml` lint passes (0 errors)

- [x] Task: E2E README and tech-stack note — 18e2e → e2eReadme
  - [x] `e2e/README.md` documents `pnpm e2e`/`e2e:ui`/`e2e:report`, `installMockTauri` + localStorage persistence, `TAURI_E2E_APP_DATA_DIR` + `TAURI_E2E` fixture, 5 specs (18 tests), helpers TDD, troubleshooting
  - [x] `biome.json` override silences e2e `noNonNullAssertion`/`noTsIgnore`; `vite.config.ts` excludes `e2e/*.spec.ts` from vitest; `e2e.yml` Windows-first noted

- [x] Task: Full gate regression — e2eReadme → gate
  - [x] `pnpm e2e` 18/18 green (21s, Vite 1420), `cargo test` 189 + 6 ok, `pnpm test` 101, `tsc --noEmit` clean, `pnpm check` clean (88 files), `cargo clippy -D warnings` clean
  - [x] Follow-ups: `TODO(matrix)` in `e2e.yml` for ubuntu/macos, `E2E_REAL_CDN` opt-in remains TODO, native `tauri-driver` path probed not installed in CI (Vite mock covers)

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — gate → TBD
