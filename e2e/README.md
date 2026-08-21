# E2E Harness (Tauri + Playwright)

Runs the 8 critical-path specs against the real app shell without building Tauri.

- **Default (Vite):** `pnpm e2e` — boots `pnpm dev` (Vite at 1420) with `TAURI_E2E=1` and installs `e2e/helpers/mock-tauri.ts` via `page.addInitScript`. No Rust, no `tauri-driver`, fully offline (mocked recitation uses `fixtures/silence.mp3`, a decodable 0.5 s silent MP3).
- **Native (opt-in):** `TAURI_E2E_NATIVE=1 pnpm e2e` — boots `pnpm tauri dev -- --port 1420`. Requires `tauri-driver` (auto-probed at `~/.cargo/bin/tauri-driver[.exe]` or `TAURI_DRIVER_PATH`).

## Commands

```bash
pnpm e2e            # headless (Chromium, 1 worker, trace on retry, screenshot on failure)
pnpm e2e:ui         # UI mode
pnpm e2e:report     # open last HTML report
```

Artifacts: `playwright-report/`, `test-results/` (ignored).

## Mock

`installMockTauri(page)` (call at `test.beforeEach`) bails if real `window.__TAURI__` exists. It in-lines `src-tauri/assets/quran/quran.json` (114 surahs, 6 236 ayahs), `cities.json` (3 000), `daily/ayahs.json` (365) + `hadiths.json` (40) and persists `settings`/`location`/`prayerLog`/`quranTranslation` in `localStorage` key `rafiq:e2e:mock` so `onboarding_complete` survives `reload()`/`goto()`. Deterministic prayer times (04:50/06:10/…), hijri anchors (2026-06-16 → 1448-01-01, 2026-05-27 → 1447-12-10). Tauri events are real: `plugin:event|listen`/`unlisten` register handlers and `trigger_test_prayer` emits `prayer-fired` (prompt) + `prayer-time` (adhan) to them. Recitation is fully playable: `get_recitation_state` returns a complete state (reciter, per-surah global offsets, cache), `fetch_ayah_audio` serves Al-Fatiha globals 1–7 from `/tmp/mock/recitation/N.mp3` paths with a cache-hit short-circuit, `report_played_position` tracks the last ayah.

## Specs (26 tests, 8 files)

- `onboarding.spec.ts` — guard → onboarding, wizard Welcome→Language→Location→Method→/, Skip, persisted complete.
- `today.spec.ts` — notSet → Jakarta prayer times (Asia/Jakarta), daily card `Open * Quran` → `/quran/<id>`, `trigger_test_prayer` → `#mock-prayer-prompt`.
- `quran.spec.ts` — list 114 via `a[href^="/quran/"]`, search `Al-Faatiha`, reader Arabic/toggle/nav, persisted `kemenag`.
- `log.spec.ts` — Today rows + Prayed, `log_prayer` → status/grid, streak analytics.
- `calendar.spec.ts` — 7-col grid, prev/next/Today, hijri anchors via invoke + UI, ±1 footnote, converter.
- `settings.spec.ts` — EN↔ID switch re-render + persistence, calculation-method switch survives reload, notification/adhan toggles persist, city search → select → resolved location.
- `recitation.spec.ts` — play Al-Fatiha from fixture audio → all 7 ayahs cached in the audio index → replay with every route blocked except cached files (zero new downloads); idle needs-download hint.
- `adhan.spec.ts` — `trigger_test_prayer` → bundled adhan audio actually plays + prompt card; with toggles persisted `'0'` prompt still shows but audio stays silent.

## Isolation

Each suite uses a fresh `page`; `e2e/helpers/isolated-dir.ts` (`createIsolatedDir`/`withIsolatedDir`) + Rust `TAURI_E2E_APP_DATA_DIR` (see `storage::db::resolve_data_dir`) backs native isolation. `e2e/fixtures/ayah-1.mp3` (8 192 B ID3 header) + `TAURI_E2E=1 && global_ayah==1` proves `src-tauri/src/recitation::try_e2e_fixture_bytes` without CDN; browser-mode playback uses `e2e/fixtures/silence.mp3`.

## Real-CDN opt-in (manual gate)

```bash
E2E_REAL_CDN=1 pnpm exec playwright test e2e/recitation.spec.ts
```

`recitation.spec.ts` normally fulfills the mocked `/tmp/mock/recitation/N.mp3` routes with local fixture bytes (offline). With `E2E_REAL_CDN=1` those same routes proxy the production CDN (`https://cdn.islamic.network/quran/audio/128/ar.alafasy/<global>.mp3`), proving the download→cache→playback pipeline against genuine network audio. Slower (real surah runtime ≈45 s), so the cache assertion relaxes to ≥5 ayahs within 90 s. Requires internet; run once before a release as a manual gate.

## CI

`.github/workflows/e2e.yml` — blocking matrix `e2e` on `[windows-latest, macos-latest, ubuntu-latest]` (Chromium, mocked Tauri) on `main`/PR; per-OS artifacts on failure. Tauri-native runs stay opt-in locally (`TAURI_E2E_NATIVE=1`).

## Helpers (TDD, vitest)

`tauri-driver.ts` (9 tests), `isolated-dir.ts` (7), `fixtures.ts` (4), `tauri.ts`/`prayer.ts` (13) — `pnpm test` covers them; `e2e/*.spec.ts` excluded from vitest via `vite.config.ts`.
