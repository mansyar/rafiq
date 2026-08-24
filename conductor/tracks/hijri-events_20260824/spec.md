# Specification — Hijri Events + Special Dates

**Track:** `hijri-events_20260824`
**Type:** Feature
**Approved:** 2026-08-24

## Overview

Rafiq computes accurate Umm al-Qura Hijri dates but treats every day alike. This
track adds awareness of the **eight major Islamic observances** so Rafiq can
mark them on the Calendar, surface what's coming on the Today page, and honor
special days with curated thematic Daily Reflection content. Everything resolves
locally from a bundled data asset against the existing ICU4X Hijri engine — no
network, no notifications, no settings; observances are ambient knowledge,
presented warmly and without gamification, consistent with the ±1-day
moon-sighting variance inherent to any computed Islamic calendar.

## Functional Requirements

### FR-1 — Observance data asset (bundled)

- **F1.1:** `src-tauri/assets/hijri-events/events.json` defines exactly 8
  events: Islamic New Year (1 Muḥarram), ʿĀshūrāʾ (10 Muḥarram), Mawlid an-Nabī
  (12 Rabīʿ al-Awwal), Ramadan begins (1 Ramaḍān), Laylat al-Qadr (27 Ramaḍān,
  `estimated: true`), Eid al-Fiṭr (1 Shawwāl), Day of ʿArafah (9 Dhū al-Ḥijjah),
  Eid al-Aḍḥā (10 Dhū al-Ḥijjah). Each entry: stable `id`, `hijri_month` (1–12),
  `hijri_day` (1–30), `estimated` flag. **No display strings in this file** —
  names/descriptions live in the i18n catalog.
- **F1.2:** `src-tauri/assets/hijri-events/content.json` maps each event id to
  its override pair: an ayah reference (`surah_id`, `ayah_number` — resolving
  against bundled Quran data, no duplicated text) and a concise hadith
  (`arabic`, `en`, `id_translation`, `source` line).
- **F1.3:** Validated by tests: unique ids, exactly 8 events, month/day in
  range, every content ayah ref resolves against bundled Quran data, non-empty
  hadith fields.
- **F1.4:** Licensing recorded in `src-tauri/assets/ATTRIBUTION.md` (existing
  pattern).

### FR-2 — Resolution logic (Rust core, pure, TDD)

- **F2.1:** Pure function: given a civil date, resolve `(hijri_month,
  hijri_day)` via the existing engine → matching event id, if any.
- **F2.2:** Pure function: given today, compute the next N (default 3) upcoming
  events **from today inclusive**, each with its resolved Gregorian date
  (forward search bounded ≤ ~370 days).
- **F2.3:** New command `get_upcoming_hijri_events(limit) → Vec<UpcomingEvent
  { id, gregorian_date, hijri_date, is_today }>`; extends `MonthGrid` day
  entries with `event_id: Option<String>` so the Calendar needs no second round
  trip; adds `event: Option<EventOverride>` to the existing `DailyContent`
  response (additive, non-breaking).
- **F2.4:** Normal daily rotation is untouched: on event days the override
  replaces the card contents; on all other days the deterministic epoch-mod
  cycle continues exactly as before.

### FR-3 — Today page: "Upcoming observances" strip

- Shows the next 3 events: localized name + one-line description + Gregorian
  date. If today is an event, it leads with a distinct "Today: <name>" emphasis
  styling.

### FR-4 — Calendar page markers

- Event cells get a gold dot marker; hover/focus/tap reveals an accessible
  tooltip with the localized name. Laylat al-Qadr renders with an "(estimated)"
  suffix; the grid's existing ±1-day footnote treatment applies to marked cells.

### FR-5 — Daily Reflection override

- On an event's civil date the Daily Reflection card presents the event's
  curated thematic ayah + hadith (with a small localized event label).
  Civil-date semantics: midnight-to-midnight local. Past event days are not
  browsable (consistent with V1 daily-content scope).

### FR-6 — i18n & presentation

- All names, descriptions, labels in `en` + `id` catalogs; Arabic sacred text
  follows sacred-presentation rules (high contrast, unobstructed, no emoji
  adjacency).

### FR-7 — Presence policy

- No OS notifications; no settings toggle — always-on ambient UI.

## Non-Functional Requirements

- **NFR-1 (Offline-first):** zero network calls.
- **NFR-2 (Privacy):** nothing leaves the device.
- **NFR-3 (Performance):** resolution + upcoming query <50 ms; no measurable
  impact on Today/Calendar render.
- **NFR-4 (Design):** restrained gold/emerald; reverent tone; no gamified
  pressure.
- **NFR-5 (i18n):** all new strings `en`/`id`.
- **NFR-6 (Testing):** >80% coverage on logic-bearing modules (asset
  validation, resolution, commands); presentational components exempt; E2E per
  AC-7.

## Acceptance Criteria

- **AC-1:** With the system clock on an event's date, Today leads the strip
  with "Today: <event>" and the Reflection card shows that event's themed
  content; on adjacent days it does not.
- **AC-2:** The strip lists the next 3 events with correct Gregorian dates
  across a month boundary and across a Hijri year boundary.
- **AC-3:** Calendar cells for event dates show gold dots; tooltips give
  localized names; Laylat al-Qadr shows "(estimated)".
- **AC-4:** Non-event-day rotation is byte-identical in behavior to pre-track
  output (unit-proven).
- **AC-5:** Asset validation tests pass (ids, ranges, ayah-ref resolution,
  hadith completeness).
- **AC-6:** All new UI fully localized `en`/`id`.
- **AC-7:** New E2E spec `e2e/hijri-events.spec.ts` passes the CI matrix using
  a mocked clock/event fixture.
- **AC-8:** Full gate green: `cargo test` + clippy, Biome, `tsc --noEmit`,
  Vitest.

## Out of Scope

- Extended event sets (White Days, monthly fasts), seasonal series
  (full-Ramadan daily content).
- Moon-sighting/per-country offset adjustments; evening (Maghrib) day-start
  semantics.
- Notifications for observances; settings toggles; past-event browsing.
- Mobile, cloud sync (standing non-goals).
