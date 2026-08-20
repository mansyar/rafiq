# Specification — Daily Ayah / Hadith

**Track:** `daily-ayah-hadith_20260821`
**Spec:** Approved 2026-08-21

## Overview
Rafiq's V1 feature #6: a **Daily Reflection** card on the **Today** page that shows one curated **ayah** (from a ~365-item curated collection referencing the already-bundled Quran text) and one hadith from the **Nawawi 40 Hadith**, each rotating on its own deterministic cycle by local date. All content is a bundled app asset — no network, no accounts, fully consistent with the offline-first principle.

## Functional Requirements

### FR-1 · Curated content assets (bundled)
- **F1.** Daily ayah collection at `src-tauri/assets/daily/ayahs.json`: ~365 curated entries, each a stable id + `surah_id` + `ayah_number` reference into the existing bundled Quran data (Arabic text and translations are **not duplicated** — resolved at runtime from the existing Quran assets).
- **F2.** Daily hadith collection at `src-tauri/assets/daily/hadiths.json`: the 40 Nawawi hadiths, each a stable id + Arabic text (concise form) + English + Indonesian translation + source line (narrator, "Nawawi 40 · Hadith N").
- **F3.** Asset validation (tested): ayah refs all resolve against the bundled Quran data; ids unique; every collection item appears exactly once per rotation cycle; hadith entries have non-empty `arabic`/`en`/`id` text.
- **F4.** Licensing: Arabic texts are public domain; EN/ID translations sourced only under verifiable permissive terms, recorded in `src-tauri/assets/ATTRIBUTION.md` (same pattern as Quran/cities/recitation).

### FR-2 · Deterministic daily rotation (Rust core, TDD)
- **F1.** Pure function: given a civil date (OS local), compute that day's ayah and hadith as `(days since fixed epoch 2026-01-01) mod <collection length>`. No randomness, no stored state — the content is a pure function of the date.
- **F2.** Tauri command `get_daily_content() → DailyContent { date, ayah {surah_id, ayah_number, arabic, translation}, hadith {id, arabic, en, id, source} }`, resolved in the OS local timezone, returning the local date used.
- **F3.** TDD tests: same date → same items; adjacent dates advance the index; full cycle covers every item exactly once (365 days → 365 distinct ayahs; 40 days → 40 distinct hadiths); leap-year/Feb boundary; invalid dates rejected.
- **F4.** >80% coverage on the new `daily` module.

### FR-3 · Daily Reflection card (Today page, frontend)
- **F1.** Read-only card below today's prayer times: header "Daily Reflection" + today's date (localized).
- **F2.** Ayah block: surah name + reference (e.g., "Al-Insan 76:24"), Arabic text (RTL, Amiri, high-contrast, unobstructed), and the translation per the user's active **`quran_translation` setting** (reused from the Quran reader).
- **F3.** Ayah block is a link → opens the existing Quran reader at that surah/ayah.
- **F4.** Hadith block: Arabic text, then the translation in the **active UI locale** (EN/ID), then the source line; long hadiths collapse gracefully (e.g., line-clamp with "more").
- **F5.** No "another item" button, no persistence — exactly one daily ayah and one daily hadith per day.
- **F6.** Re-resolves on app start and local date rollover (same mechanism as the Today page's existing date-sensitive blocks).

### FR-4 · Internationalization (EN + ID)
- **F1.** All card chrome strings via the i18n catalog under a `daily.*` namespace; nothing hardcoded.
- **F2.** Hadith EN/ID translations are content data (from the asset), selected by the active UI locale.
- **F3.** Arabic sacred text is locale-independent and rendered with the existing bidi/RTL conventions.

## Non-Functional Requirements
- **N1.** 100% offline — zero network calls for this feature.
- **N2.** `get_daily_content` returns well under 50 ms (pure computation over already-loaded bundled data).
- **N3.** Determinism: the same local date yields the same content on every machine.
- **N4.** Reverent presentation per product guidelines: sacred text high-contrast and unobstructed; no emojis or decorative clutter adjacent to it; card styled with the gold/emerald tokens.
- **N5.** Accessibility: ARIA labels, keyboard-operable ayah link, readable contrast.
- **N6.** Workflow compliance: TDD for the rotation engine + asset validation (logic-bearing), >80% coverage on the new Rust module; the presentational card needs no tests per project rule.

## Acceptance Criteria
- **AC-1.** The Today page shows the Daily Reflection card with one ayah and one hadith for today's local date; all chrome strings correct in EN and ID.
- **AC-2.** Clicking the ayah opens the Quran reader at the correct surah/ayah; the displayed translation matches the active `quran_translation` setting and updates when it changes.
- **AC-3.** Rotation is deterministic (test-proven): same date → same content; a full cycle visits every ayah and every hadith exactly once before repeating.
- **AC-4.** Asset validation passes: all ayah references resolve, hadith fields complete, translations recorded in ATTRIBUTION.
- **AC-5.** The feature works fully with the network disabled.
- **AC-6.** Full gate passes: `cargo fmt`/`clippy`/`test`, Biome, `tsc --noEmit`, Vitest; new Rust module coverage >80%.

## Out of Scope
- Special-date content (Ramadan, 10th of Muharram, etc.) — candidate for a future track.
- Copying/sharing, favorites, or browsing past days' items.
- Additional hadith collections or growing the curated ayah set beyond the bundled ~365.
- Notifications or push for the daily content.
- Per-user randomization or "show me another".
