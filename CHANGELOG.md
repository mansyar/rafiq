# Changelog

All notable changes to Rafiq will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-08-23

Recitation upgrades — more control over how you listen to the Qur'an, and easier management of downloaded audio.

### Added

- Playback speed control in the Quran reader footer (0.75× to 2× presets), applied instantly and remembered across sessions.
- Repeat modes: loop a single ayah, or repeat a whole surah.
- Optional "continue to next surah" auto-advance that carries playback hands-free across surah boundaries and follows along in the reader.
- "Recitation downloads" card in Settings showing total and per-surah disk usage, with per-surah deletion and a confirmed clear-all; deleting audio that is currently playing stops playback gracefully.

## [1.0.0] - 2026-08-22

First stable release of Rafiq — a calm, offline-first Muslim companion for desktop.

### Added

- Prayer times for seven calculation methods, with city search (3,000+ cities) or manual coordinates; times are computed locally and work fully offline.
- Quran reader covering all 114 surahs with three translations (Saheeh International, The Clear Quran, Kemenag) and verse-by-verse recitation audio that downloads ahead of playback and is cached for offline replay.
- Adhan playback at each prayer time with an in-app prompt to log the prayer as performed.
- Daily reflection card pairing a Qur'an verse with a hadith from Nawawi's 40.
- Hijri calendar view with month navigation and today's date anchored to astronomical calculation.
- English and Indonesian interfaces throughout.
- Silent background update checks (at most once per day) with a one-click "restart to update" flow; updates are verified against a minisign signature.

### Notes

- Windows and macOS builds are not code-signed yet; SmartScreen (Windows) and Gatekeeper (macOS) may show a warning on first run. See the README for what to expect.

## [1.0.0-rc.1] - 2026-08-22

First public release candidate of Rafiq — a calm, offline-first Muslim companion for desktop.

### Added

- Prayer times for seven calculation methods, with city search (3,000+ cities) or manual coordinates; times are computed locally and work fully offline.
- Quran reader covering all 114 surahs with three translations (Saheeh International, The Clear Quran, Kemenag) and verse-by-verse recitation audio that downloads ahead of playback and is cached for offline replay.
- Adhan playback at each prayer time with an in-app prompt to log the prayer as performed.
- Daily reflection card pairing a Qur'an verse with a hadith from Nawawi's 40.
- Hijri calendar view with month navigation and today's date anchored to astronomical calculation.
- English and Indonesian interfaces throughout.
- Silent background update checks (at most once per day) with a one-click "restart to update" flow; updates are verified against a minisign signature.

### Notes

- Windows and macOS builds are not code-signed yet; SmartScreen (Windows) and Gatekeeper (macOS) may show a warning on first run. See the README for what to expect.
