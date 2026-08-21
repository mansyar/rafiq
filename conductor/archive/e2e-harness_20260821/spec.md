# Specification — Full Tauri E2E Harness

**Track:** `e2e-harness_20260821`
**Type:** Chore (testing infrastructure)
**Date:** 2026-08-21

## Overview

Deliver a **production-ready Tauri 2 E2E harness** for Rafiq that proves the completed V1 offline on all critical paths using the real Rust core (SQLite migrations, prayer calculation, scheduler, Quran/Hijri/daily/log/recitation commands) running inside the actual Tauri WebView. The harness uses the stack prescribed in `tech-stack.md` — **`tauri-driver` + `@playwright/test`** — and is operable locally via a single `pnpm e2e` command and in CI on a Windows-first runner. The harness establishes the pattern for future E2E: **ephemeral `app_data_dir` per test** (fresh `rafiq.db` at `SCHEMA_VERSION=3`), a **mocked Islamic Network CDN fixture** (deterministic tiny MP3) to avoid flakiness, and deterministic prayer firing via `trigger_test_prayer` (in-app `prayer-fired` prompt) rather than wall-clock waiting or OS toast checks.

V1 is already complete (7 features + foundation, 252 unit tests green). This track closes the only open testing gap (“E2E: tauri-driver / Playwright integration — evaluated during v1”).

## Functional Requirements

### FR-1 — Harness bootstrap (deps + config + script)

- **F1.1** Add harness deps: `tauri-driver` (via `cargo install tauri-driver` / `tauri-driver` crate binary), `@playwright/test`, `wait-on`, `playwright` browsers. Pin versions in `package.json` + document in `tech-stack.md` dated note (2026-08-21) if any version diverges.
- **F1.2** Provide `playwright.config.ts` at repo root: `webServer` boots Tauri in E2E mode (`cargo run -- --` or `tauri dev` with `TAURI_E2E=1` flag), `tauri-driver` as WebDriver bridge (port 4444), `timeout`/`expect` tuned for WebView boot (~30s), `retries: 1` on CI.
- **F1.3** Add `pnpm e2e` script: ensures `tauri-driver` is installed, runs `playwright test` with `CI=true` semantics, forwards `TAURI_E2E_APP_DATA_DIR` when set. Must be non-interactive and CI-aware per `workflow.md`.
- **F1.4** The app must respect `TAURI_E2E_APP_DATA_DIR` (env var) in `src-tauri/src/storage/db.rs: init_db` / `lib.rs: setup`: when set, use that dir instead of `app.path().app_data_dir()` (isolated tmp per test). Falls back to normal path when not set. No change to production behavior when unset.

### FR-2 — Isolation & fixtures

- **F2.1** Per-test isolation helper `e2e/helpers/isolated-dir.ts`: creates a temp directory (`os.tmpdir()/rafiq-e2e-<uuid>`), sets `TAURI_E2E_APP_DATA_DIR` for that test, and cleans up afterwards. Each test starts with a **fresh DB** (`rafiq.db` auto-migrated to version 3). Helper is logic-bearing → TDD with unit tests (path creation, cleanup).
- **F2.2** Mocked recitation CDN: `e2e/fixtures/ayah-1.mp3` — a tiny valid MP3 (silence) served by a local fixture interceptor. `fetch_ayah_audio` flow: when `TAURI_E2E=1`, the download client is intercepted (or the fixture file is pre-seeded into `recitation/`) so the test proves caching/indexing without hitting `cdn.islamic.network`. One opt-in “real network” test is allowed but skipped by default (`test.skip` unless `E2E_REAL_CDN=1`).
- **F2.3** Seeded helpers: `e2e/helpers/tauri.ts` wrappers for common commands (`get_setting`, `set_location` with Jakarta), and `e2e/helpers/prayer.ts` for deterministic `trigger_test_prayer` firing.
- **F2.4** No global shared DB. Tests never rely on order; each test's DB is blank (except seeded data it explicitly creates).

### FR-3 — Critical-path E2E tests (first increment)

All tests run against the **real Tauri app** (no mocked Rust). Playwright asserts on the DOM; Tauri commands are invoked via the app's own `invoke` pipeline (or Playwright's ability to eval in WebView). Each flow is independent and cleans up.

- **F3.1 Onboarding guard:** Fresh DB (no `onboarding_complete`) → `"/"` redirects to `"/onboarding"` (outside `Layout`, no sidebar), `"/settings"` also redirects. Steps: `welcome` carousel (3 slides, dot indicators, keyboard), `language` (cards EN/ID, `id*` locale detection), `location` (debounced city search ≥ Jakarta, manual lat/long validation), `method` (7 methods, MWL preselected). `Skip` from any step → `"/"` with defaults (warning “No location set” when no city chosen). `Finish` → `"/"` with live prayer times. Quit mid-wizard (relaunch with same tmp dir *without* the flag) → still on `/onboarding`; relaunch *with* persisted `onboarding_complete=true` → `/` . “Run setup again” in Settings → `/onboarding` with values prefilled.
- **F3.2 Today — prayer times + daily reflection:** With Jakarta location + MWL set, Today shows location label, method label, prayer list (6 entries: Fajr/Sunrise/Dhuhr/Asr/Maghrib/Isha) with next-prayer highlight (via `trigger_test_prayer` for determinism), timezone footnote, warning absent. `DailyReflectionCard` shows one ayah (Arabic RTL Amiri + translation per `quran_translation`) and one hadith (arabic/en or id per UI locale), ayah link → correct `quran/:id`.
- **F3.3 Quran reader:** `/quran` lists 114 surahs in Mushaf order; search (“Baqara”/“2”/Arabic substring) filters ranked. Open `quran/1` → Bismillah header, 7 ayahs side-by-side (Arabic RTL + translation), translation switcher (Sahih/Clear/Kemenag) persists. Open `quran/9` → no Bismillah. Clicking an ayah highlights current (gold ring) — verified via player state even without audio.
- **F3.4 Prayer log + analytics:** Without location → Log shows “no location” prompt. With Jakarta, log `Fajr` via `log_prayer` (on-time window) → Log page shows `on_time` badge, 7-day grid cell `bg-emerald-500/70`, streak `current=1`, monthly summary reflects. Delete → back to “missed”. Retroactive grid (≤7 days) qada path verified. Early-tap guard: today's future prayer button disabled.
- **F3.5 Calendar — Hijri:** `/calendar` shows today's Hijri date (e.g., `day month year` localized + Arabic `dir=rtl`), month grid (29/30 days per Umm al-Qura, Gregorian overlay), navigation prev/next/Today, `DateConverter` round-trip anchors (`2026-06-16 = 1 Muharram 1448`, `2026-05-27 = 10 Dhu al-Hijjah 1447`), footnote `±1 day` localized in both views.

### FR-4 — Developer experience & artifacts

- **F4.1** Single command: `pnpm e2e` (and `pnpm e2e:ui` for Playwright UI). `CI=true pnpm e2e` for one-shot.
- **F4.2** Artifacts: screenshot on failure, trace on retry (`trace: 'on-first-retry'`), HTML report (`playwright-report/`), `test-results/` — gitignored. Respect `workflow.md` “Non-Interactive & CI-Aware”.
- **F4.3** Docs: `e2e/README.md` explains local run, `TAURI_E2E_APP_DATA_DIR`, mocked CDN, and how to run one file (`pnpm e2e e2e/onboarding.spec.ts`). Short dated note in `tech-stack.md` (§Testing / Dev Tools) describing the harness.

### FR-5 — CI wiring (Windows-first)

- **F5.1** Add `.github/workflows/e2e.yml`: trigger on `pull_request` and `push` to `main`, single job `e2e-windows` (`runs-on: windows-latest`), steps: `pnpm install --frozen-lockfile`, `cargo install tauri-driver --locked` (cached), `npx playwright install --with-deps`, `pnpm e2e` (behind `TAURI_E2E=1`). Artifacts upload (`playwright-report`, `test-results`) on failure. Uses `TAURI_E2E_APP_DATA_DIR=%TEMP%/rafiq-e2e-${{ github.run_id }}` ephemeral.
- **F5.2** No macOS/Linux matrix in this track; leave a `TODO(matrix):` comment in the workflow for the follow-up track.
- **F5.3** The existing PR gate (`fmt, clippy, biome, typecheck, tests, coverage`) remains; E2E is an additional job (not blocking release until stable — `continue-on-error: true` for the first 2 weeks, then required).

## Non-Functional Requirements

- **N1 Offline-first preserved:** App code is unchanged offline; E2E only adds an env-var branch for `app_data_dir`. No network in production except `fetch_ayah_audio` CDN fetch (mocked in tests).
- **N2 Performance:** Full E2E suite (5 specs, ~15 tests) completes in <5 min on `windows-latest`. Per-test WebView boot ≤30s, no unbounded `wait-on` polling.
- **N3 Determinism:** No real-time waiting for prayer windows. All time-sensitive assertions use `trigger_test_prayer` or fixed `2026-06-16` fixtures. `todayHijri` mocked via fixed OS date when needed (or `page.clock`).
- **N4 Privacy/security:** No secrets in repo, no external telemetry, no ads. Mocked MP3 fixture is local. No change to CSP/assetProtocol (already `enable:true`).
- **N5 Design/i18n retained:** E2E asserts ARIA, RTL, gold/emerald tokens, and both EN/ID chrome where relevant, but does not add new UI.
- **N6 Testing discipline (workflow.md):** Helpers (`isolated-dir.ts`, `tauri.ts`) are logic-bearing → TDD (>80% coverage via existing Vitest where applicable). Presentational app code needs no new unit tests. E2E is integration-level.

## Acceptance Criteria

- **AC-1** `pnpm e2e` boots the real Tauri app via `tauri-driver` and Playwright connects (no manual WebDriver start). `CI=true pnpm e2e` exits non-interactively.
- **AC-2** Each test starts with a fresh `rafiq.db` (`SCHEMA_VERSION=3`) — proven by: create entry in test A, assert absent at start of test B in same suite run.
- **AC-3** Onboarding guard specs green: no flag → redirect; Finish/Skip → `onboarding_complete=true` persists; “Run setup again” prefills.
- **AC-4** Today spec green: Jakarta+MWL → 6 times + next highlight + location/method labels; Daily card renders ayah+hadith with correct translation/locale, ayah link opens correct surah.
- **AC-5** Quran spec green: 114 surahs, search ranking, surah 1 Bismillah vs 9 without, translation switcher persists (checked via `get_setting`).
- **AC-6** Log spec green: with/without location branches, on-time vs qada classification, early-tap guard, streak/month reflect, delete restores missed.
- **AC-7** Calendar spec green: today's Hijri, month grid navigation, converter round-trip on anchors, footnotes localized.
- **AC-8** Mocked CDN: `fetch_ayah_audio` with fixture resolves to cached file without network (verified by disconnecting network — test still passes when `TAURI_E2E=1`).
- **AC-9** DX: `screenshots`/`traces` appear in `test-results/` on induced failure; `playwright-report/` HTML opens; `e2e/README.md` steps reproduce locally on Windows in ≤3 commands.
- **AC-10** CI: PR opens → `e2e-windows` job appears, runs `pnpm e2e`, uploads artifacts on failure. No change to existing `cargo fmt/clippy/biome/tsc/vitest` gate.
- **AC-11** No production regression: `cargo test` 184, `vitest` 68, `tsc --noEmit`, `biome check`, `clippy -D warnings` all still green after harness lands.

## Out of Scope

- Full OS matrix (macOS/Linux) — follow-up track.
- Real CDN download tests (except one opt-in skipped test), OS-level notification toast verification, adhan audio playback verification (in-app `prayer-fired` event is the stable surface).
- Screenshot/visual regression baselines, coverage collection from WebView, performance profiling.
- Additional flows beyond the 5 critical-path specs (e.g., full ayah audio playback, “Daily” browsing past days, manual window edge cases) — expand in later E2E track.
- tauri-driver version hosting / self-hosted runners.
