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

- [ ] Task: Shared Tauri helpers (TDD)
  - [ ] `e2e/helpers/tauri.ts`: `setJakartaLocation(page)`, `setTranslation(page, tr)`, `getSettingViaInvoke(page, key)` — Playwright eval of `window.__TAURI__.invoke`
  - [ ] `e2e/helpers/prayer.ts`: `triggerTestPrayer(page, prayer)` wrapping `trigger_test_prayer` + wait for `prayer-fired` event
  - [ ] Unit-tested where logic-bearing (arg validation, URL mapping)

- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — Critical-Path E2E Tests

> **Goal:** 5 spec files, ~15 tests, all against the real app + ephemeral DB. Use `trigger_test_prayer` for determinism, not wall-clock.

- [ ] Task: Onboarding guard specs
  - [ ] `e2e/onboarding.spec.ts`: redirects (`/`→`/onboarding`, `/settings`→`/onboarding`), carousel (3 slides, dots, keyboard), language cards, city search (Jakarta), manual lat/long validation, method list (7, MWL default), Skip/Finish persistence, quit-mid-wizard restarts, “Run setup again” prefill
  - [ ] Ensure each test uses `withIsolatedDir` and seeds/clears `onboarding_complete` as needed
  - [ ] Verify: all onboarding tests green locally via `pnpm e2e e2e/onboarding.spec.ts`

- [ ] Task: Today + Daily Reflection spec
  - [ ] `e2e/today.spec.ts`: with Jakarta+MWL → location/method labels, 6 prayer times + next highlight (triggered), timezone footnote, no warning; without location → warning; `DailyReflectionCard` renders ayah (Arabic RTL) + hadith per locale, ayah link navigates to correct `quran/:id` with correct translation
  - [ ] Test both `en` and `id` locales via `setSetting('locale')` + reload

- [ ] Task: Quran reader specs
  - [ ] `e2e/quran.spec.ts`: `/quran` 114 order, search (Baqara/2/Arabic), `quran/1` Bismillah vs `quran/9` no Bismillah, ayah count, side-by-side columns class, translation switcher persists (assert via `getSetting`), clicking ayah sets gold ring / player state
  - [ ] Include navigation (prev/next surah links)

- [ ] Task: Prayer log + analytics specs
  - [ ] `e2e/log.spec.ts`: without location → prompt; with Jakarta → log Fajr on-time → badge `on_time`, grid emerald, streak 1, monthly %; delete → missed; retroactive ≤7d qada; early-tap guard (future prayer button disabled)
  - [ ] Use `trigger_test_prayer` + `log_prayer` deterministic windows; never sleep for real time

- [ ] Task: Hijri calendar specs
  - [ ] `e2e/calendar.spec.ts`: today's Hijri (`today_hijri`), month grid 29/30 + Gregorian overlay, prev/next/Today nav, `DateConverter` round-trip `2026-06-16=1 Muharram 1448` and `2026-05-27=10 Dhu al-Hijjah 1447`, localized footnotes (`±1 day`) in both views
  - [ ] Verify deterministic via fixed `hijri_from_gregorian` anchors, not live date math

- [ ] Task: Wire mocked CDN into at least one flow
  - [ ] In `quran.spec.ts` or dedicated `e2e/recitation.spec.ts` (minimal): call `fetch_ayah_audio(1)` with `TAURI_E2E=1` → resolves to fixture MP3, appears in `RecitationState.cached`; disconnect check (test still passes with fixture even if network down)

- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — CI & Documentation

> **Goal:** Windows-first CI job + docs. No matrix in this track.

- [ ] Task: Add GitHub Actions E2E workflow
  - [ ] Create `.github/workflows/e2e.yml`: `pull_request` + `push:main`, job `e2e-windows` (`windows-latest`), steps `pnpm install --frozen-lockfile`, `cargo install tauri-driver`, `npx playwright install --with-deps`, `pnpm e2e`, artifact upload `playwright-report` + `test-results` on failure, `TAURI_E2E_APP_DATA_DIR=$RUNNER_TEMP/rafiq-e2e-${{ github.run_id }}`, `continue-on-error: true` with `TODO(matrix):` comment
  - [ ] Verify: workflow validates via `actionlint` / dry-run (or at least `yaml` lint)

- [ ] Task: E2E README and tech-stack note
  - [ ] Write `e2e/README.md`: local `pnpm e2e` (3 commands), how to run single file, `TAURI_E2E_APP_DATA_DIR` contract, mocked CDN fixture note, troubleshooting Windows WebView2
  - [ ] Add dated note to `tech-stack.md` §Testing / §Dev Tools: harness exists, `tauri-driver` + `@playwright/test`, Windows-first, ephemeral dir pattern

- [ ] Task: Full gate regression
  - [ ] Run `CI=true pnpm e2e` locally (expect all 5 specs green), then `cargo test` (184), `pnpm test` (68), `tsc --noEmit`, `biome check`, `cargo clippy -D warnings` — all green
  - [ ] Document any `TODO(matrix)` / `E2E_REAL_CDN` follow-ups in `plan.md` for next track

- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
