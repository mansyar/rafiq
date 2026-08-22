# Spec — Recitation Playback Upgrades

## Overview
Enhance the v1 recitation player (Alafasy, per-ayah download-and-cache) with four
quality-of-life upgrades: **playback speed presets**, **ayah/surah repeat**,
**optional auto-advance into the next surah**, and a **cache management section in
Settings**. Fully offline, consistent with Rafiq's calm, minimal UX.

### Goals
- Memorization aid (ayah loop), continuous listening (auto-advance), flexible
  pace (speed), storage control (cache management).

## Functional Requirements

### FR-1 — Preference persistence
- FR-1.1 Three new setting keys:
  - `recitation_speed`: `"0.75" | "1" | "1.25" | "1.5" | "2"` (default `"1"`)
  - `recitation_repeat_mode`: `"off" | "ayah" | "surah"` (default `"off"`)
  - `recitation_auto_advance`: `"true" | "false"` (default `"false"`)
- FR-1.2 Read at player init via the existing `get_setting` command; every change
  written through immediately via `set_setting`; invalid stored values silently
  fall back to defaults (no error UI).

### FR-2 — Playback speed
- FR-2.1 Cycle button in the reader footer steps through
  `[0.75×, 1×, 1.25×, 1.5×, 2×]`, wrapping after 2×.
- FR-2.2 Sets `<audio>.playbackRate` — applies instantly mid-playback and to all
  later ayahs; never restarts audio.
- FR-2.3 Button label shows the current value (e.g. `1.25×`) with a descriptive
  aria-label; EN/ID strings.

### FR-3 — Repeat modes
- FR-3.1 Segmented control: Off · Repeat ayah · Repeat surah.
- FR-3.2 *Ayah loop*: on `ended`, replay the same ayah from the start;
  last-played position stays on that ayah.
- FR-3.3 *Surah repeat*: at natural end-of-surah, restart from ayah 1
  (downloading ahead as usual).
- FR-3.4 **Precedence:** ayah-loop → surah-repeat → auto-advance.

### FR-4 — Auto-advance
- FR-4.1 Persistent footer toggle "Continue to next surah" (off by default).
- FR-4.2 At natural end-of-surah (no repeat mode active, toggle on): advance to
  the next surah; the **reader auto-navigates** so audio and view stay in sync;
  playback starts at ayah 1 of the new surah.
- FR-4.3 Stops cleanly after Surah 114 (An-Nas) — no wrap-around.

### FR-5 — Cache management
- FR-5.1 New Rust commands backed by new `RecitationRepo` methods (no schema
  migration needed — the table already stores `size_bytes`):
  - cache summary: total bytes + per-surah aggregates `{surahId, ayahCount, sizeBytes}`
  - delete one surah's cached files
  - delete all cached files
- FR-5.2 Deletion removes both DB rows and MP3 files on disk; missing files are
  tolerated (rows removed regardless).
- FR-5.3 Settings gains a "Recitation cache" card: total size, per-surah rows
  (surah name, ayah count, size, delete button), delete-all button.
- FR-5.4 Delete-all asks for confirmation; single-surah delete is immediate;
  deleting the currently-playing surah stops playback gracefully.
- FR-5.5 Card live-updates after deletions; friendly empty-state when nothing
  is cached.

## Non-Functional Requirements
- NFR-1: All new user-facing strings exist in EN + ID catalogs.
- NFR-2: No new network calls; all cache operations are local-only.
- NFR-3: Playback-mode logic extends the pure `playerReducer` so it is testable
  without DOM.
- NFR-4: Full keyboard accessibility + ARIA labels / live-region announcements
  on all new controls.
- NFR-5: Cache summary computed in a single SQL pass; deletion must not block
  the UI thread perceptibly.

## Acceptance Criteria
- AC-1: Speed persists across restart; applies instantly mid-playback.
- AC-2: Ayah-loop repeats indefinitely until toggled off; surah-repeat restarts
  the surah; both persist.
- AC-3: With auto-advance on, finishing Al-Fatiha navigates the reader to
  Al-Baqarah and plays ayah 1 hands-free; playback ends after An-Nas.
- AC-4: Precedence rules hold: ayah-loop blocks advancing; surah-repeat blocks
  auto-advance.
- AC-5: Sizes shown match disk contents; confirmed delete-all reaches the
  empty-state; a deleted surah re-downloads on next play.
- AC-6: Corrupt preference values fall back to defaults without error UI.
- AC-7: E2E recitation spec extended: speed cycling, repeat wrap, auto-advance
  navigation using the mocked audio backend.

## Out of Scope
- Multiple reciters
- Global mini-player / background playback with hidden window
- Bookmarks, play queues, tafsir
- Adhan audio modifications (speed/effects)
- Cache auto-eviction policies (LRU etc.)
- Extra keyboard shortcuts beyond standard focus order (follow-up candidate)

## References
- Archived upstream track: `conductor/archive/audio-recitation_20260820/` (v1 player)
- Tech stack notes (2026-08-20/21): recitation CDN, asset protocol wiring
