# Specification — Prayer Log + Analytics

**Track:** Prayer Log + Analytics
**Type:** Feature
**Date:** 2026-08-20

## Overview

Deliver the **Log** screen — the third core screen (Today, Quran, Log) — closing
Rafiq's daily-practice loop. Users record the five daily prayers by tapping a
"Prayed" action on the existing prayer-time notification, or manually from the
UI (including up to 7 days retroactively). Each entry is classified
**on-time vs qada** via the prayer-window rule. The Log screen shows today's
prayer list with one-tap logging, a 7-day grid, current + best streak, and a
current-month completion summary with on-time / qada / missed breakdown. All
data stays local (SQLite, migration 2); analytics are computed in Rust and
unit-tested.

## Functional Requirements

### FR-1: Prayer logging

- **FR-1.1:** A log entry = one record per (local date, prayer) for the 5
  obligatory prayers (Fajr, Dhuhr, Asr, Maghrib, Isha). Sunrise is never
  loggable.
- **FR-1.2:** **Prayer-time prompt:** when a prayer time fires, the app shows
  a small in-app prompt (global, visible on any screen) with a localized
  one-tap "Prayed" button; tapping logs that prayer with the tap moment as
  `logged_at`. The OS notification remains informational (see FR-1.7).
- **FR-1.3:** **Manual logging:** the Log screen shows today's 5 prayers with
  one-tap log / unlog controls.
- **FR-1.4:** **Retroactive logging:** prayers from the previous 7 calendar
  days can be logged by tapping the 7-day grid. Older than 7 days: not
  available in v1.
- **FR-1.5:** **Correction:** entries can be deleted (re-tap) to fix accidental
  taps; re-logging re-classifies.
- **FR-1.6:** **Location dependency:** logging requires a resolved location
  (window classification needs computed times); without one, the UI shows a
  friendly "set your location" prompt (no crash, no silent drop).
- **FR-1.7:** **Platform reality (verified 2026-08-20):**
  `tauri-plugin-notification` 2.3.3's desktop path is a plain `notify_rust`
  wrapper — no action-button API and no click/action events on desktop (all
  action APIs are mobile-only). OS notifications therefore stay informational
  on all desktop platforms; the in-app prompt (FR-1.2) + manual logging
  (FR-1.3) is the universal one-tap path.

### FR-2: On-time vs qada classification

- **FR-2.1:** At log time, classify by the **prayer-window rule**: `on_time` if
  `logged_at` falls within `[prayer start, next prayer start)`, else `qada`.
  Window chain: Fajr→Sunrise, Dhuhr→Asr, Asr→Maghrib, Maghrib→Isha,
  Isha→next Fajr.
- **FR-2.2:** Windows are computed for the prayer's date using the user's
  current location + calculation method.
- **FR-2.3:** Classification is computed **once, at log time**, and persisted
  with the entry — later location/method changes never re-grade history.
- **FR-2.4:** Late-tapped queued notifications fall out of the window and
  classify as qada by the same rule (no special case).

### FR-3: Log screen (today-first)

- **FR-3.1:** Replace the `/log` placeholder route with the Log page.
- **FR-3.2:** **Top section:** today's 5 prayers in order, each with status
  (not logged / on-time / qada) and a one-tap log/delete control.
- **FR-3.3:** **7-day grid:** today + previous 6 days × 5 prayers; cell states:
  on-time (filled), qada (alternate fill), missed/empty (unfilled). Cells in
  the retroactive window are tappable to log.
- **FR-3.4:** **Streaks:** current + best. Day complete = all 5 prayers logged
  (on-time or qada). Streak = consecutive complete calendar days; if today is
  already complete it counts, otherwise the current streak runs through
  yesterday.
- **FR-3.5:** **Monthly summary (current month):** completion % (logged /
  expected instances for elapsed days) plus a logged-entry breakdown:
  on-time % / qada % / missed %.
- **FR-3.6:** **Empty state:** first-run shows a gentle, non-guilt-inducing
  invitation (tone per product-guidelines — encouraging, never preachy).
- **FR-3.7:** All UI strings in `en` + `id` catalogs under `log.*`.

### FR-4: Storage & commands

- **FR-4.1:** New SQLite table `prayer_log` via **migration 2**: `id`,
  `log_date` (YYYY-MM-DD local), `prayer` (one of the 5), `logged_at`
  (RFC3339 UTC), `status` (`on_time`|`qada`), `UNIQUE(log_date, prayer)`.
- **FR-4.2:** Typed Tauri commands: `log_prayer(date, prayer)`,
  `delete_log_entry(date, prayer)`, `get_prayer_log(from, to)`,
  `get_log_analytics(...)` (streaks + monthly summary). Analytics logic lives
  in Rust (logic-bearing → unit-tested); the frontend renders.

## Non-Functional Requirements

- **NFR-1 (Offline-first):** no network calls anywhere in this feature.
- **NFR-2 (Privacy):** data never leaves the device.
- **NFR-3 (Performance):** grid/month queries <50 ms and log write <10 ms, even
  after years of data.
- **NFR-4 (Design):** restrained gold/emerald per product-guidelines; reverent
  tone; **no gamified pressure** (no confetti, no "on fire" effects); keyboard
  navigable, proper ARIA labels.
- **NFR-5 (i18n):** all new strings `en`/`id`.
- **NFR-6 (Testing):** >80% coverage for logic-bearing modules
  (classification, repository, streak/monthly computation, commands);
  presentational components exempt per project rule.

## Acceptance Criteria

- **AC-1:** Tapping "Prayed" on the prayer-time prompt logs the prayer as
  on-time (within window); Log screen reflects it immediately.
- **AC-2:** Tapping a past grid cell (≤7 days) logs it — qada, except the
  boundary case (yesterday's Isha tapped before today's Fajr → on-time).
- **AC-3:** Classification verified by fixtures: Fajr logged before sunrise →
  on-time; after sunrise → qada; Isha logged after next-day Fajr → qada (fixed
  location/date, unit-tested).
- **AC-4:** Streak computation verified with fixtures: gap day breaks streak,
  best-streak tracked, today-incomplete handled.
- **AC-5:** Monthly % correct on a fixture month with mixed on-time / qada /
  missed days.
- **AC-6:** Entries persist across restart; delete works; re-logging
  re-classifies.
- **AC-7:** No location set → logging blocked with friendly prompt, no crash.
- **AC-8:** Log screen fully localized `en`/`id`.
- **AC-9:** Full gate passes: `cargo test` + clippy, Biome, `tsc --noEmit`,
  Vitest.

## Out of Scope

- Browsable history beyond the 7-day window / current month (natural follow-up
  track)
- Data export, cloud sync/backup (V1 non-goals)
- Configurable grace periods or streak criteria
- Tracking beyond the 5 daily prayers (no wudu, no voluntary prayers)
- Qibla, tafsir, and other stated V1 non-goals

## Amendment (2026-08-20, Phase 4)

FR-1.2 / FR-1.7 / AC-1 reworked: the OS-notification "Prayed" action button is
not achievable with the current stack — `tauri-plugin-notification` 2.3.3's
desktop path has no action API and emits no click/action events (verified in
the plugin source during Phase 4). The prayer-time one-tap is delivered as an
in-app prompt driven by a new always-on `prayer-fired` event emitted by the
scheduler (independent of the notification/adhan toggles). A dated note was
added to `conductor/tech-stack.md`.
