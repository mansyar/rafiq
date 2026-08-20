# Specification — Prayer Times + Adhan

**Track:** Prayer Times + Adhan
**Type:** Feature
**Date:** 2026-08-20

## Overview

Deliver the first core daily-practice capability of Rafiq: accurate daily prayer
times with user-selectable calculation method, location management via bundled
city database or manual coordinates, desktop notifications, and adhan audio
playback at each prayer time. The feature follows the established architecture:
`adhan` Rust crate for calculation, `tauri-plugin-notification` for alerts,
HTML5 `<audio>` for adhan playback, and the existing settings persistence for
user preferences.

## Functional Requirements

### FR-1: Prayer time calculation

- **FR-1.1:** Compute Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha for any date and
  location using the `adhan` Rust crate.
- **FR-1.2:** Support all 7 standard calculation methods — MWL (default), ISNA,
  Egyptian, Umm al-Qura, Karachi, Tehran, Jafari.
- **FR-1.3:** Method is user-selectable via Settings and persisted across
  restarts.
- **FR-1.4:** Handle high-latitude edge cases per the calculation method's
  recommended rules (the `adhan` crate's default behavior).

### FR-2: Location management

- **FR-2.1:** Bundle a city database of ~3,000 cities (city name, country,
  latitude, longitude, timezone) as an embedded asset.
- **FR-2.2:** Provide city search (by name/country, EN/ID aware) and selection.
- **FR-2.3:** Allow manual latitude/longitude entry as a fallback when no city
  matches.
- **FR-2.4:** Persist the selected location and resolve it at startup for
  calculation.

### FR-3: Today page

- **FR-3.1:** Display today's prayer times (Fajr, Dhuhr, Asr, Maghrib, Isha +
  sunrise) in the existing "Today" route.
- **FR-3.2:** Highlight the next upcoming prayer.
- **FR-3.3:** Show the location and calculation method currently in use; strings
  localized EN/ID.

### FR-4: Notifications

- **FR-4.1:** Fire a desktop notification at each prayer time using
  `tauri-plugin-notification`.
- **FR-4.2:** Notification includes the localized prayer name.
- **FR-4.3:** Respect an enabled/disabled toggle persisted in settings (default:
  enabled).

### FR-5: Adhan audio

- **FR-5.1:** Play bundled open-license adhan audio at each prayer time alongside
  the notification.
- **FR-5.2:** Audio asset licensing **verified** (public-domain/CC0 or explicit
  free license) before bundling; record license + attribution in the repo.
- **FR-5.3:** Respect an adhan on/off toggle persisted in settings (default:
  enabled).

## Non-Functional Requirements

- **NFR-1 (Offline-first):** All calculation, search, and playback work fully
  offline; no network calls.
- **NFR-2 (Accuracy):** Calculation correctness verified against reference
  fixtures (known city/date → expected times) in unit tests.
- **NFR-3 (Performance):** Calculation is synchronous and cheap (<5 ms); city
  search indexed for instant filtering.
- **NFR-4 (Design):** UI follows product-guidelines — gold/emerald palette,
  reverent typography, accessible labels.
- **NFR-5 (i18n):** All new user-facing strings available in `en` and `id`
  catalogs.
- **NFR-6 (Testing):** Logic-bearing modules (calculation service, location
  resolution, notification scheduling) covered by unit tests (>80% coverage per
  workflow); presentational components exempt per project rule.

## Acceptance Criteria

- **AC-1:** For a fixed reference location and date, computed times match known
  reference values for the default (MWL) method within 1 minute (unit-tested
  fixtures).
- **AC-2:** Switching calculation method in Settings changes computed times and
  persists across restart.
- **AC-3:** A user can search and select a bundled city; the Today page then
  shows correct times for that city.
- **AC-4:** Manual lat/long entry works and persists; invalid coordinates are
  rejected with a friendly error.
- **AC-5:** With the app running, a notification + adhan fires at an upcoming
  prayer time (verified manually at a temporarily adjusted time or with a test
  trigger).
- **AC-6:** Notification/adhan toggles persist and are respected.
- **AC-7:** Today page renders localized times in `en` and `id` without errors.
- **AC-8:** Full gate passes: `cargo test` + clippy, Biome, `tsc --noEmit`,
  Vitest.

## Out of Scope

- Qibla direction
- Hijri calendar integration on the Today page (separate V1 feature)
- Download-on-demand adhan audio
- Auto-detection of location (no GPS/geo services)
- Mobile platforms