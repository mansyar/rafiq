# E2E Harness (Tauri + Playwright)

Runs the 5 critical-path specs against the real app shell without building Tauri.

- **Default (Vite):** `pnpm e2e` — boots `pnpm dev` (Vite at 1420) with `TAURI_E2E=1` and installs `e2e/helpers/mock-tauri.ts` via `page.addInitScript`. No Rust, no `tauri-driver`, fully offline (mocked recitation fixture `ayah-1.mp3` <8 KB).
- **Native (opt-in):** `TAURI_E2E_NATIVE=1 pnpm e2e` — boots `pnpm tauri dev -- --port 1420`. Requires `tauri-driver` (auto-probed at `~/.cargo/bin/tauri-driver[.exe]` or `TAURI_DRIVER_PATH`).

## Commands

```bash
pnpm e2e            # headless (Chromium, 1 worker, trace on retry, screenshot on failure)
pnpm e2e:ui         # UI mode
pnpm e2e:report     # open last HTML report
```

Artifacts: `playwright-report/`, `test-results/` (ignored).

## Mock

`installMockTauri(page)` (call at `test.beforeEach`) bails if real `window.__TAURI__` exists. It in-lines `src-tauri/assets/quran/quran.json` (114 surahs, 6 236 ayahs), `cities.json` (3 000), `daily/ayahs.json` (365) + `hadiths.json` (40) and persists `settings`/`location`/`prayerLog`/`quranTranslation` in `localStorage` key `rafiq:e2e:mock` so `onboarding_complete` survives `reload()`/`goto()`. Deterministic prayer times (04:50/06:10/…), hijri anchors (2026-06-16 → 1448-01-01, 2026-05-27 → 1447-12-10), and event stubs (`transformCallback`, `plugin:event|listen`) suppress `adhan-player`/`prayer-prompt` errors in Vite.

## Specs (18 tests, 5 files)

- `onboarding.spec.ts` — guard → onboarding, wizard Welcome→Language→Location→Method→/, Skip, persisted complete.
- `today.spec.ts` — notSet → Jakarta prayer times (Asia/Jakarta), daily card `Open * Quran` → `/quran/<id>`, `trigger_test_prayer` → `#mock-prayer-prompt`.
- `quran.spec.ts` — list 114 via `a[href^="/quran/"]`, search `Al-Faatiha`, reader Arabic/toggle/nav, persisted `kemenag`.
- `log.spec.ts` — Today rows + Prayed, `log_prayer` → status/grid, streak analytics.
- `calendar.spec.ts` — 7-col grid, prev/next/Today, hijri anchors via invoke + UI, ±1 footnote, converter.

## Isolation

Each suite uses a fresh `page`; `e2e/helpers/isolated-dir.ts` (`createIsolatedDir`/`withIsolatedDir`) + Rust `TAURI_E2E_APP_DATA_DIR` (see `storage::db::resolve_data_dir`) backs native isolation. `e2e/fixtures/ayah-1.mp3` (8 192 B ID3 header) + `TAURI_E2E=1 && global_ayah==1` proves `src-tauri/src/recitation::try_e2e_fixture_bytes` without CDN.

## CI

`.github/workflows/e2e.yml` — blocking matrix `e2e` on `[windows-latest, macos-latest, ubuntu-latest]` (Chromium, mocked Tauri) on `main`/PR; per-OS artifacts on failure. Tauri-native runs stay opt-in locally (`TAURI_E2E_NATIVE=1`).

## Helpers (TDD, vitest)

`tauri-driver.ts` (9 tests), `isolated-dir.ts` (7), `fixtures.ts` (4), `tauri.ts`/`prayer.ts` (13) — `pnpm test` covers them; `e2e/*.spec.ts` excluded from vitest via `vite.config.ts`.
