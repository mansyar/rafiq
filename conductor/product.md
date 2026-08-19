# Product Definition — Rafiq (رفيق)

## Vision
A private, offline-first, cross-platform desktop companion that helps Muslims
practice their faith consistently, without compromising their privacy.

## Elevator Pitch
Rafiq (Arabic: رفيق, "companion") is a privacy-first, offline-capable desktop
application for practicing Muslims. It delivers accurate prayer times with adhan
notifications, a Quran reader with multiple translations and audio recitation, a
prayer log with consistency analytics, a Hijri calendar, and daily ayah/hadith
guidance — all on-device.

## Problem Statement
Mainstream Muslim apps are ad-heavy, subscription-based, and data-hungry. Islamic
practice is a private matter; the tools that support it should be trustworthy,
beautiful, and entirely local. Rafiq exists so that a Muslim's daily worship is
never monetized or surveilled.

## Target Audience
- Practicing Muslims worldwide (public release)
- Languages: English + Indonesian

## Core Principles
1. **Privacy first** — offline-first, all data stays on-device; no accounts, no
   cloud, no telemetry, no ads.
2. **Beauty & reverence** — Islamic aesthetic: geometric patterns, gold and
   emerald palette, calligraphic touches.
3. **Simplicity & focus** — the essentials of daily practice, done well.
4. **Open & free** — MIT/Apache-2.0 licensed, free on GitHub Releases.

## V1 Features
1. **Prayer Times + Adhan** — accurate daily prayer times with all 7 standard
   calculation methods (MWL default; ISNA, Egypt, Umm al-Qura, Karachi, Tehran,
   Jafari — user-selectable); bundled city database (~3,000 cities) with search
   and manual lat/long fallback; full adhan audio + desktop notification at each
   prayer time.
2. **Quran Reader** — Arabic text with English translations (Sahih International,
   The Clear Quran) and Indonesian translation (Kemenag); parallel view;
   per-surah navigation.
3. **Audio Recitation** — Mishary Alafasy; download-on-demand per surah, cached
   forever locally; offline playback.
4. **Prayer Log + Analytics** — log each prayer; track on-time vs qada; streak
   tracking; progress reports (daily / weekly / monthly).
5. **Hijri Calendar** — Umm al-Qura basis; Hijri↔Gregorian conversion; today's
   Hijri date.
6. **Daily Ayah / Hadith** — fresh curated content each day to keep the user
   connected.

## Non-Goals (V1)
- Mobile application
- Cloud sync / user accounts
- Tafsir (exegesis)
- Data export
- Paid / premium content

## Success Metrics
Since the app is offline-first by design, success is measured by adoption,
retention of the daily-practice habit, and community reception of the open-source
release — not by telemetry.

## Distribution
- License: MIT / Apache-2.0
- Channels: GitHub Releases (Windows · macOS · Linux)
- Price: Free forever

## Content Licensing Notes
- Quran text: public domain
- Translations: Sahih International / The Clear Quran (free licenses),
  Kemenag (Indonesian government publication, free to use)
- Recitation: Mishary Alafasy — **licensing to be verified** during the audio
  track (fallback reciters identified if needed)