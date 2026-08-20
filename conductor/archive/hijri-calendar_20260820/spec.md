# Specification — Hijri Calendar

## Overview
Rafiq's V1 feature #5: a dedicated top-level **Calendar** tab presenting the
Umm al-Qura (KACST) Hijri calendar. It offers a navigable month grid with
Gregorian overlay dates, today's highlighted Hijri date, and a bidirectional
Hijri↔Gregorian date converter. All conversion is computed on-device in the
Rust core via **ICU4X `icu_calendar`** (Umm al-Qura) — no network, no
accounts, fully consistent with the offline-first principle.

## Functional Requirements

### FR-1 · Conversion engine (Rust core)
- **F1.** New Rust module (`src-tauri/src/hijri/`) wrapping ICU4X
  `icu_calendar`'s Umm al-Qura calendar.
- **F2.** Tauri commands exposed to the frontend:
  - `hijri_from_gregorian(year, month, day) → HijriDate`
  - `hijri_to_gregorian(hijri_year, month, day) → GregorianDate`
  - `hijri_month_grid(year, month) → MonthGrid` — day count (29/30) plus, per
    day: Gregorian date, weekday, and an `is_today` flag.
  - `today_hijri() → HijriDate` — resolved in the OS local timezone.
- **F3.** Dates are **civil calendar dates** (no time component).
- **F4.** Conversions are valid for **all** dates — unbounded navigation, no
  hard range errors, no approximation caveats.

### FR-2 · Month view (frontend)
- **F1.** 7-column grid; each cell shows the Hijri day number plus its
  Gregorian date (with month label where the Gregorian month changes).
- **F2.** Month header: Hijri month name in the active locale + Hijri year,
  with the **Arabic-script name as a secondary line** (e.g., رمضان).
- **F3.** Navigation: Previous / Next month, plus a **Today** button that
  jumps to the current Hijri month.
- **F4.** Today's cell highlighted with the design system's gold accent.
- **F5.** Discreet footnote: dates are computed Umm al-Qura; local religious
  observance may differ by **±1 day** (localized).

### FR-3 · Date converter
- **F1.** Widget converting a chosen date in both directions:
  - **Gregorian → Hijri:** pick/enter a Gregorian date → Hijri date with
    locale + Arabic month name.
  - **Hijri → Gregorian:** pick/enter day, month (locale name), and year →
    Gregorian date with weekday.
- **F2.** Reuses the same Tauri commands as the month view (single source of
  conversion logic).
- **F3.** Same ±1 day footnote as the month view.

### FR-4 · Today's Hijri date
- **F1.** Prominently displayed in the tab (e.g., "3 Muharram 1448" in the
  active locale) with the Arabic month name.
- **F2.** Recomputed on app start and local date rollover; no persistence.

### FR-5 · Internationalization (EN + ID)
- **F1.** All strings through the existing i18n catalog; nothing hardcoded.
- **F2.** Locale-native month names:

  | Month | English | Indonesian |
  |---|---|---|
  | 1 | Muharram | Muharram |
  | 2 | Safar | Safar |
  | 3 | Rabi al-Awwal | Rabiul Awal |
  | 4 | Rabi al-Thani | Rabiul Akhir |
  | 5 | Jumada al-Awwal | Jumadil Awal |
  | 6 | Jumada al-Thani | Jumadil Akhir |
  | 7 | Rajab | Rajab |
  | 8 | Sha'ban | Sya'ban |
  | 9 | Ramadan | Ramadhan |
  | 10 | Shawwal | Syawal |
  | 11 | Dhu al-Qa'dah | Dzulqa'dah |
  | 12 | Dhu al-Hijjah | Dzulhijjah |

- **F3.** Arabic-script names are locale-independent (single set:
  محرم، صفر، ربيع الأول، ربيع الآخر، جمادى الأولى، جمادى الآخرة، رجب، شعبان،
  رمضان، شوال، ذو القعدة، ذو الحجة).
- **F4.** Weekday names and number formatting follow locale conventions.

### FR-6 · Navigation integration
- **F1.** New top-level tab in the main navigation, following the existing
  section pattern (Prayer Times, Quran, Prayer Log).
- **F2.** Opens at the current Hijri month by default; no state persistence.

## Non-Functional Requirements
- **N1.** 100% offline — zero network calls for this feature.
- **N2.** Month-grid conversion + render well under 50 ms (pure computation).
- **N3.** Accuracy: results must match the Umm al-Qura computed calendar.
  Reference anchors (from published Umm al-Qura data, verified in the
  ICU4X-built `hijri` CLI):
  - 2026-06-16 (Tue) = **1 Muharram 1448 AH** (Islamic New Year 1448)
  - 2026-06-18 (Thu) = **3 Muharram 1448 AH**
  - 2026-05-27 (Wed) = **10 Dhu al-Hijjah 1447 AH**
- **N4.** Arabic header text renders correctly (bidi-safe context).
- **N5.** Workflow compliance: TDD for the conversion engine (logic-bearing),
  >80% coverage on the new Rust module; presentational UI components need no
  tests per project rule.

## Acceptance Criteria
- **AC-1.** Opening the Calendar tab shows today's Hijri date and the current
  month grid; today's cell is highlighted.
- **AC-2.** Any Hijri month renders the correct day count (29/30 per
  Umm al-Qura) with correct Gregorian overlays.
- **AC-3.** Converter matches N3 anchors in both directions, and round-trips:
  `hijri_to_gregorian(hijri_from_gregorian(d)) == d` across a sampled year
  range.
- **AC-4.** Both locales show correct month names; Arabic secondary line
  renders correctly.
- **AC-5.** The ±1 day footnote is present and localized in both the month
  view and converter.
- **AC-6.** Feature works fully with the network disabled.
- **AC-7.** `cargo test`, `clippy`, and `biome` all pass; new Rust module
  coverage >80%.

## Out of Scope
- Event display / day detail (Eids, Ramadan, Ayyam al-Bid) — candidate for a
  future track.
- Observational (moon-sighting) calendar or per-country offsets.
- Last-viewed-month persistence, week-start customization.
- Notifications tied to Hijri dates.
- Data export/sharing, or any religious content curation.
