# Specification — Quran Reader

**Track:** Quran Reader
**Type:** Feature
**Date:** 2026-08-20

## Overview

Deliver the Quran reading core of Rafiq: Uthmani Arabic with three verified translations (Sahih International, The Clear Quran, Kemenag) in an offline, reverent reader. Users browse 114 surahs in Mushaf order, search by name/number, and read continuous ayahs with Bismillah headers in a side-by-side Arabic/translation layout that persists the selected translation.

## Functional Requirements

### FR-1: Bundled Quran content
- **FR-1.1:** Bundle Uthmani Arabic text (Tanzil) + 3 translations as local assets (`src-tauri/assets/quran/`) — no network at runtime.
- **FR-1.2:** 114 surahs with metadata: id (1-114), Arabic name, transliteration (EN), Indonesian name, ayah count, revelation type.
- **FR-1.3:** Ayah records: ayah number, Arabic Uthmani text, per-translation texts aligned by ayah. Bismillah handled per Tanzil (surah 1 includes, surah 9 excludes, others as separate header).
- **FR-1.4:** License attribution (`ATTRIBUTION.md`) for Tanzil (CC) and translations (Sahih/Clear/Kemenag free), verified before bundling.

### FR-2: Translation selection
- **FR-2.1:** Single active translation at a time (Sahih International default) — mirrors prayer method persistence pattern.
- **FR-2.2:** User switches via Settings or reader switcher; persisted via `SettingsRepo` key `quran_translation` across restarts.
- **FR-2.3:** Invalid stored value falls back to default.

### FR-3: Surah navigation & search
- **FR-3.1:** Surah list in Mushaf order (1-114) showing number, Arabic name, transliteration, Indonesian name, ayah count.
- **FR-3.2:** Search case-insensitive substring across English transliteration, Indonesian name, Arabic name, and number; ranked top-N (mirrors city search scoring).
- **FR-3.3:** Opening a surah shows all ayahs continuously (no pagination); no ayah-jump in v1.

### FR-4: Reader presentation
- **FR-4.1:** Continuous ayah blocks: side-by-side columns on desktop (Arabic RTL + translation LTR) and stacked vertically on narrow/mobile.
- **FR-4.2:** Bismillah header rendered as reverent centered line where applicable (not as ayah 0).
- **FR-4.3:** Ayah numbers displayed, sacred text high-contrast per product-guidelines; no decorative clutter.
- **FR-4.4:** Gold/emerald palette, responsive, keyboard navigable, ARIA labels.

### FR-5: Typography
- **FR-5.1:** Bundle Amiri font for Arabic; webview RTL/bidi rendering verified.
- **FR-5.2:** Arabic font-size scalable, line-height generous for readability.

## Non-Functional Requirements
- **NFR-1 (Offline-first):** All content local, search <5ms, indexed; no fetch.
- **NFR-2 (Accuracy):** 114 surahs, ayah counts exact per Tanzil; alignment validation tests.
- **NFR-3 (Performance):** Surah load <50ms, search indexed OnceLock, bundle size reasonable (<5 MB JSON).
- **NFR-4 (Design):** Follows `product-guidelines.md` — reverent, gold/emerald restrained, sacred text high-contrast, no emojis adjacent to Arabic.
- **NFR-5 (i18n):** All UI strings in `en`/`id` catalogs under `quran.*`.
- **NFR-6 (Testing):** Logic-bearing (loader, search, commands) >80% coverage; presentational components exempt per project rule.

## Acceptance Criteria
- **AC-1:** 114 surahs load offline with correct ayah counts; `get_surah(1)` returns Al-Fatihah with Bismillah handling correct.
- **AC-2:** Switching translation in Settings/reader persists across restart and changes displayed translation.
- **AC-3:** Surah search matches EN transliteration, ID name, Arabic, and number (e.g., "2", "baqara", "البقرة") ranked.
- **AC-4:** Reader renders side-by-side desktop / stacked mobile; Arabic RTL verified; Amiri loaded.
- **AC-5:** Bismillah shown for applicable surahs, hidden for Al-Tawbah (9).
- **AC-6:** High-contrast sacred text, gold/emerald tokens, ARIA labels pass.
- **AC-7:** All new UI strings localized `en`/`id`.
- **AC-8:** Full gate passes: `cargo test` + clippy, `biome`, `tsc --noEmit`, `vitest`.

## Out of Scope
- Audio recitation (separate track)
- Tafsir / exegesis
- Mushaf pagination / Juz/Hizb navigation
- Ayah-level deep link / bookmark
- Writing/notes
- Mobile-specific optimizations (desktop-first)
