# Specification — Onboarding First-Run Flow

**Track:** `onboarding-first-run_20260821`
**Type:** Feature
**Approved:** 2026-08-21

## Overview

Rafiq currently launches straight into the Today page, which dead-ends with a
"No location set" warning for new users: prayer times cannot be computed, the
scheduler idles, and prayer logging errors until the user discovers Settings on
their own. This track adds a one-time, full-screen onboarding wizard that walks
new users through the minimum configuration Rafiq needs — language, location,
and prayer calculation method — using warm, reverent presentation consistent
with the product guidelines. The wizard is skippable (defaults are kept),
re-runnable from Settings, and requires **no new backend surface**: every step
persists through existing Rust commands (`get_setting` / `set_setting`,
`set_location`, `search_cities`, `get_resolved_location`).

## Functional Requirements

### FR-1 — Wizard Shell & Routing
- The wizard lives at a full-screen `/onboarding` route rendered **outside**
  the main `Layout` (no sidebar).
- On app start, if the persisted setting `onboarding_complete` is absent or
  `false`, the user is redirected to `/onboarding` and cannot reach the main
  app until they Finish or Skip.
- The flag is read and written exclusively via the existing
  `get_setting` / `set_setting` commands (SQLite settings table).

### FR-2 — Wizard Flow
- Four ordered steps: **Welcome → Language → Location → Calculation Method**,
  with Back/Next navigation and a step progress indicator.
- Notification/adhan preferences are **not** part of the wizard; they keep
  their defaults (enabled) and remain changeable in Settings.

### FR-3 — Language Step
- Two selectable cards: English / Bahasa Indonesia.
- Preselected from the OS via `navigator.language` (`id*` → Indonesian,
  otherwise English) — purely local detection, no network.
- Choosing a language applies it immediately (`i18n.changeLanguage`) and
  persists it right away via `set_setting('locale')`.

### FR-4 — Location Step
- Reuses the Settings pattern: debounced (~300 ms) city search over
  `search_cities` plus a manual latitude/longitude entry form, saved via
  `set_location`.
- Inline validation errors for malformed coordinates.
- When the wizard is re-run, current values are prefilled from
  `get_resolved_location`.
- The step may be left empty (Skip / Next without selection); Rafiq then keeps
  its existing behavior (Today page warning box).

### FR-5 — Calculation Method Step
- Lists all 7 standard methods from the existing `CALCULATION_METHODS`
  catalog, with Muslim World League (MWL) preselected.
- Selection persists via `set_setting('prayer_calculation_method')`.

### FR-6 — Completion Semantics
- **Finish** and **Skip** both persist `onboarding_complete = true` and then
  navigate to the Today page.
- The flag is written **only** on Finish/Skip: quitting the app mid-wizard
  restarts the wizard from step 1 on next launch.
- A persistent **Skip** control sits in the wizard header on every step;
  skipping keeps defaults (English, MWL, no location).

### FR-7 — Internationalization
- Every wizard string lives under an `onboarding.*` namespace in
  `src/i18n/locales/en.json` and `id.json`; the two catalogs stay
  key-identical.

## Non-Functional Requirements

- **N1 — Offline:** 100% on-device; the wizard performs no network calls.
- **N2 — No new backend:** No new Rust commands or schema changes; existing
  commands only.
- **N3 — Accessibility:** Keyboard-navigable steps and carousel, visible focus
  states, labeled controls.
- **N4 — Testing:** TDD for logic-bearing pieces only (flag parsing, system
  locale detection, step state machine) with Vitest; presentational wizard UI
  is exempt per the project testing rule.
- **N5 — Quality gate:** Biome clean, `tsc --noEmit` clean, full Vitest suite
  green before completion.

## Acceptance Criteria

- **AC-1:** First launch with no `onboarding_complete` setting opens the
  full-screen wizard; the main app is unreachable until Finish/Skip.
- **AC-2:** The Welcome step shows a 3-slide feature mini-carousel
  (Prayer Times + Adhan · Quran Reader + Audio Recitation · Prayer Log +
  Analytics) with dot indicators and keyboard navigation.
- **AC-3:** On an Indonesian-system device the Language step arrives
  preselected to Bahasa Indonesia (otherwise English); switching applies the
  UI language instantly and survives an app restart.
- **AC-4:** City search returns results while typing (debounced) and manual
  lat/lon entry validates input inline; a chosen location is saved and used by
  prayer-time computation.
- **AC-5:** All 7 calculation methods are listed with MWL preselected; the
  choice persists and affects computed prayer times.
- **AC-6:** Finishing the wizard lands on the Today page showing live prayer
  times for the configured location.
- **AC-7:** Skipping from any step lands on Today with defaults retained (the
  existing "No location set" warning remains if no location was set).
- **AC-8:** Quitting mid-wizard and relaunching reopens the wizard at step 1;
  "Run setup again" at the top of Settings reopens the wizard with previously
  saved values prefilled.

## Out of Scope

- Notification / adhan preference steps (defaults-on; managed in Settings).
- Autostart opt-in prompt (plugin wiring exists but stays out of this flow).
- Any new Rust commands, database migrations, or network features.
- Data export, tafsir, cloud sync (V1 non-goals).
