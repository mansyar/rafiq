# Specification — Audio Recitation

**Track:** Audio Recitation
**Type:** Feature
**Date:** 2026-08-20

## Overview

Deliver Rafiq's V1 **Audio Recitation** feature: Mishary Rashid Alafasy recitation of every ayah, playable inside the Quran reader. Audio is downloaded on demand from the Islamic Network CDN (128 kbps per-ayah MP3) and cached forever locally. Users play from the surah header, start from any clicked ayah, see the current ayah highlighted, and retain their position across navigation and app restarts. Once cached, a surah plays fully offline.

## Functional Requirements

### FR-1: Recitation source & licensing
- **FR-1.1:** Audio source = Islamic Network CDN per-ayah MP3: `https://cdn.islamic.network/quran/audio/128/ar.alafasy/{global_ayah}.mp3`, global ayah 1–6236 mapped via bundled Quran metadata.
- **FR-1.2:** **Gate:** verify the source's license (CDN terms + recitation rights) before runtime fetching ships; document the finding in `ATTRIBUTION.md`. If not verifiable, switch to a pre-identified fallback edition from the same CDN (canonical list: `api.alquran.cloud/v1/edition/format/audio`, e.g. `ar.husary`, `ar.minshawi`) and document the decision in `tech-stack.md`.
- **FR-1.3:** Reciter name displayed beside the player (EN/ID localized); attribution recorded for the bundled-attributions file.

### FR-2: On-demand download & permanent cache
- **FR-2.1:** Per-ayah files stored in the platform app-data directory under a `recitation/` subfolder, keyed by global ayah number.
- **FR-2.2:** Downloads triggered only by explicit user play, with visible progress in the player footer; sequential fetching keeps playback continuous. No background prefetch in v1.
- **FR-2.3:** Files cached **forever** — no delete/clear in v1. Valid cached files never re-download; partial/corrupt downloads re-fetch on next play.
- **FR-2.4:** Cached files tracked in the SQLite audio index (global ayah, path, size, fetched at) via `rusqlite`, consistent with the existing storage layer.

### FR-3: Reader player
- **FR-3.1:** Play/pause control in the surah header; pressing play starts from the surah's last-played ayah, or ayah 1 if none recorded.
- **FR-3.2:** Clicking an ayah block starts playback from that ayah (overrides remembered position).
- **FR-3.3:** Current playing ayah highlighted in the reader (Arabic + translation columns); highlight advances as playback progresses.
- **FR-3.4:** Compact player footer in the reader: play/pause, stop, current position (surah:ayah), download progress indicator, reciter name.
- **FR-3.5:** End of surah → playback stops and position resets. No auto-advance to next surah in v1.

### FR-4: Position & navigation behavior
- **FR-4.1:** Last played ayah per surah persisted (audio index), so reopening the surah resumes at the same ayah, across sessions and app restarts.
- **FR-4.2:** Leaving the reader pauses playback and keeps position; returning to the same surah resumes from the paused ayah on play.

### FR-5: Offline & failure handling
- **FR-5.1:** Fully cached surahs/ayahs play with no network — no spinners, no failure states.
- **FR-5.2:** Download failure (no network / CDN error) → calm inline message in the player footer with a retry action; cached ayahs remain playable during a failure.
- **FR-5.3:** Play control state reflects availability (ready vs. needs fetch).

## Non-Functional Requirements
- **NFR-1 (Offline-first):** Network used only to fetch uncached audio; all other reader behavior unchanged offline.
- **NFR-2 (Performance):** Cached playback starts within ~1s; progress visible while fetching; no unbounded concurrent downloads (small bounded lookahead window).
- **NFR-3 (Privacy):** No telemetry; audio fetching is the only new network activity, triggered solely by explicit user action.
- **NFR-4 (Design):** Reverent — no emojis adjacent to Quranic text, gold/emerald tokens, highlight must not obstruct sacred text; keyboard navigable, ARIA labels.
- **NFR-5 (i18n):** All UI strings in `en`/`id` catalogs under `quran.audio.*`.
- **NFR-6 (Testing):** >80% coverage for logic-bearing modules (audio index, URL mapping, fetch/cache state machine, position persistence); presentational components exempt per project rule.

## Acceptance Criteria
- **AC-1:** Pressing play on an uncached surah starts download, shows progress, then plays from ayah 1 with highlight advancing per ayah.
- **AC-2:** Clicking ayah N starts playback at N; highlight follows.
- **AC-3:** Restarting the app mid-surah resumes at the last played ayah.
- **AC-4:** Navigating away pauses; returning and pressing play resumes at the paused ayah.
- **AC-5:** A fully cached surah plays end-to-end with no network.
- **AC-6:** Simulated network failure shows the calm inline message + retry; cached content unaffected.
- **AC-7:** License verified and documented in `ATTRIBUTION.md`; reciter name shown in player.
- **AC-8:** Full gate passes: `cargo test` + clippy, `biome`, `tsc --noEmit`, `vitest`.

## Out of Scope
- Multiple reciter selection (single reciter; config-swappable only if the licensing fallback triggers)
- Global mini-player across screens; background playback with hidden/minimized window
- Playback speed control, repeat/loop, play queues
- Auto-advance to next surah
- Cache management / deleting audio
- Background prefetch / pre-caching UI
- Tafsir, bookmarks, mushaf pagination (already out of scope in the reader)
