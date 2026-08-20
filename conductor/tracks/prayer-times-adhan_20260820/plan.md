# Implementation Plan — prayer-times-adhan_20260820

**Track:** Prayer Times + Adhan
**Type:** Feature
**Methodology:** TDD per `conductor/workflow.md`; tests required only for
logic-bearing code (project rule: calculation engines, storage, state,
commands — presentational components exempt).

## Phase 1 — Prayer Calculation Engine (Rust, TDD) [checkpoint: 9e51393]

*Goal: `adhan` crate integration with typed outputs and command handlers.*

- [x] Task 1.1: Add dependencies + write failing tests (Red) — d1b609b
  - [x] Add `adhan` + `chrono` crates to `Cargo.toml`
  - [x] Create `src-tauri/src/prayer/mod.rs` with test-first spec: reference fixtures for a known city/date (MWL expected times within ±1 min); method enum (7 methods); serializable output struct (`PrayerTimes { fajr, sunrise, dhuhr, asr, maghrib, isha }`)
  - [x] Run `cargo test` → confirm red (module/type unresolved)
- [x] Task 1.2: Implement prayer service (Green) — 7402c54
  - [x] Wrapper around `adhan::PrayerTimes`; `CalculationMethod` mapping for all 7 methods, MWL default
  - [x] Handle high-latitude edge cases per crate defaults
  - [x] Run `cargo test` → green; `cargo clippy` clean
- [x] Task 1.3: Prayer command handlers (TDD) — 9e51393
  - [x] Failing tests: `get_prayer_times(date, coordinates, method)` — valid input, invalid coordinates rejected, method overrides default, date parsing errors
  - [x] Implement commands + expose in `commands.rs`/`lib.rs`; wire method default from settings; tests green
- [x] Task: Phase Verification & Checkpoint (per `workflow.md`)

## Phase 2 — Location & City Database (Rust, TDD) [checkpoint: a55663b]

*Goal: bundled ~3,000-city dataset with search and manual lat/long fallback.*

- [x] Task 2.1: Acquire & curate city dataset — 79ba3dc
  - [x] Source public dataset (~3,000 cities: name, country, lat, lon, timezone; license-compatible — e.g., CC BY 4.0)
  - [x] Embed as `src-tauri/assets/cities.json` + `ATTRIBUTION` license note
  - [x] Dataset validation test: loads, count ≥ 3,000, required fields present, coordinates in range, unique city ids
- [x] Task 2.2: Write failing tests for city store + resolution (Red) — 9a5f121
  - [x] Search by name/country substring, case-insensitive, ranked top-N results
  - [x] Manual lat/long validation (range, parse errors → friendly error)
  - [x] Location resolution: `city_id` → coordinates, or manual coordinates fallback
- [x] Task 2.3: Implement city store + resolution (Green) — c47da5d
  - [x] Lazy-load embedded dataset once; indexed search; typed `Location`/`City` structs
  - [x] Run tests → green; clippy clean
- [x] Task 2.4: Location settings + commands (TDD) — a55663b
  - [x] Failing tests: `get_location`/`set_location` persist via settings repo; invalid input rejected
  - [x] Implement commands; tests green
- [x] Task: Phase Verification & Checkpoint (per `workflow.md`)

## Phase 3 — Today Page & Settings UI (Frontend) [checkpoint: f705a09]

*Goal: user-facing Today page + settings controls. Presentational — no tests
required (project rule); logic helpers tested.*

- [x] Task 3.1: Data layer + i18n — aa18a86
  - [x] Add `@tanstack/react-query` (per `tech-stack.md`); `src/lib/prayer.ts` client wrapping `invoke` (getPrayerTimes, getLocation, setLocation)
  - [x] i18n keys en/id: prayer names, location, method, toggles, next-prayer labels
  - [x] Unit tests for any date/format helpers (`src/lib/` logic) if logic-bearing
- [x] Task 3.2: Build Today page — f705a09
  - [x] Render today's 5 prayer times + sunrise from `get_prayer_times`
  - [x] Highlight next upcoming prayer; show location + method in use
  - [x] Style per design tokens (gold/emerald, reverent typography, ARIA labels)
- [x] Task 3.3: Settings UI additions — f705a09
  - [x] Calculation method selector (7 methods) → persists via `set_setting`
  - [x] Location: city search + select, or manual lat/long entry; validation errors localized
  - [x] Notification + adhan toggles (defaults enabled) → persist via settings
- [x] Task 3.4: Verify shell in dev — f705a09
  - [x] `pnpm tauri dev` renders pages; Biome + `tsc --noEmit` pass
- [x] Task: Phase Verification & Checkpoint (per `workflow.md`)

## Phase 4 — Notifications & Adhan Audio [checkpoint: c973941]

*Goal: desktop notification + adhan playback at each prayer time.*

- [x] Task 4.1: Adhan audio asset — 10470c5
  - [x] Obtain small open-license (public-domain/CC0 or verified free) adhan audio; verify license; add `src/assets/audio/adhan.mp3` + `ATTRIBUTION`
  - [x] Playback helper component (`<audio>`), preloaded, no UI chrome
- [x] Task 4.2: Scheduler logic (TDD) — c973941
  - [x] Failing tests: `next_prayer_times(location, method, now)` — returns upcoming prayer + instant; fires only for enabled toggles; respects persisted settings — 7fba896
  - [x] Implement scheduler module: background thread sleeping until next prayer, fires notification via `tauri-plugin-notification`, emits `prayer-time` event to frontend; reschedules on settings change
- [x] Task 4.3: WebView autoplay enablement + event wiring — c973941
  - [x] Configure webview additional browser args (`--autoplay-policy=no-user-gesture-required`) so adhan plays without interaction (Tauri `with_additional_browser_args`)
  - [x] Frontend listens for `prayer-time` event → plays audio; toggles respected
- [x] Task 4.4: Manual verification — c973941
  - [x] Trigger at a temporarily adjusted time/test trigger → notification fires + adhan plays; toggles disable behavior
- [x] Task: Phase Verification & Checkpoint (per `workflow.md`)

## Phase 5 — Integration Gate & Acceptance

*Goal: full quality gate + spec acceptance walk.*

- [x] Task 5.1: Full local gate
  - [x] `cargo fmt` + `clippy -D warnings` + `cargo test`; `pnpm check` (Biome) + `tsc --noEmit` + Vitest
  - [x] Fix issues; commit
- [x] Task 5.2: Acceptance criteria verification — c973941
  - [x] Walk spec AC-1..AC-8; record results in plan notes
  - Notes:
    - AC-1 (MWL fixture ±1 min): `prayer::tests::prayer_times_mwl_raleigh_2015_07_12_within_one_minute` — uses Raleigh 2015-07-12 MWL vs adhan crate, passes within 60s.
    - AC-2 (method switch persists): `commands::tests::get_prayer_times_uses_persisted_method_when_override_is_absent` + `get_prayer_times_persisted_tehran` + frontend `setCalculationMethod` → `prayer_calculation_method` setting, invalidate `prayer-method`/`prayer-times`.
    - AC-3 (city search → Today): `city::tests::search_returns_jakarta...` + `search_ranking_prefix_first` + `commands::tests::resolve_stored_location_after_set` (Jakarta) + `pages/today.tsx` uses `getResolvedLocation` + `getPrayerTimes`.
    - AC-4 (manual lat/long): `city::tests::parse_coordinate_valid/invalid` + `commands::tests::set_then_get_location_manual_roundtrip` + `set_location_rejects_invalid_manual_coordinates` (91,0) + Settings manual inputs with validation.
    - AC-5 (notification + adhan at prayer time): `scheduler::tests` (next_prayer, including_tomorrow, should_fire) + `spawn_scheduler` thread (NotificationExt + emit `prayer-time`) + `trigger_test_prayer` manual trigger + `adhan-player.tsx` listen → `<audio>` play; verified via Settings Test buttons.
    - AC-6 (toggles persist & respected): `getNotificationEnabled`/`getAdhanEnabled` (default true, tolerant 1/true/enabled) + `should_fire` requires both + `trigger_test_prayer` respects each toggle individually + Settings toggles persist via `setSetting` and reschedule via `request_reschedule`.
    - AC-7 (Today localized): `i18n` en/id keys for `prayer.*`, `today.*`, `settings.*` + `Today` uses `t('prayer.${name}')`, `t('today.nextPrayer')`, `formatPrayerTime` with locale; `Settings` uses `t('settings.methods.*')`.
    - AC-8 (full gate): 5.1 gate passed — see gate results below.
    - Gate 5.1 results (2026-08-20): `cargo fmt --check` clean, `cargo clippy -D warnings` clean, `cargo test --lib 55 passed`, `pnpm biome check` 21 files clean, `pnpm tsc --noEmit` pass, `pnpm test 17 passed` (locale 4 + prayer 13), `tauri.conf additionalBrowserArgs` present, `adhan.mp3` CC0.
- [~] Task: Phase Verification & Checkpoint (per `workflow.md`)
