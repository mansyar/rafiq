# Specification — Recitation follow-scroll

**Track:** `recitation-follow-scroll_20260823` · **Type:** feature · **Status:** approved draft

## Overview

While recitation plays in the Quran reader, the viewport follows the recited
ayah so listeners can read along hands-free on long surahs. Users keep full
control of scrolling: moving away suspends the chase, and a floating button
restores position instantly.

## Functional requirements

- **FR-1 Follow while playing** — On every ayah change while status is
  `playing`, smooth-scroll the highlighted ayah card to vertical center
  (`block: 'center'`). When the user prefers reduced motion
  (`prefers-reduced-motion`), positioning is instant instead of animated.
- **FR-2 Graceful manual override** — If the user scrolls so the active ayah
  has zero viewport overlap while playback is active, auto-following suspends
  and never fights the reader. It resumes automatically the moment any part of
  the active ayah re-enters the viewport ("any overlap" rule).
- **FR-3 Floating jump button** — Visible exactly when playback is active
  (**playing or paused**) *and* the active ayah is out of view. A calm pill
  anchored near the bottom of the reader — EN *"Jump to reciting ayah"* /
  ID *"Ke ayat yang dibaca"*. Tapping smooth-centers the active ayah (instant
  under reduced motion) and resumes following.
- **FR-4 State lifecycle** — Stopping playback, starting a new play, or an
  auto-advance surah navigation resets following to "on". Repeat-ayah loops
  replay the same position and never move the viewport.

## Non-functional requirements

- **NFR-1** All new strings live in the single i18n catalog, EN + ID,
  parity-checked.
- **NFR-2** No new network calls; no persisted settings (follow state is
  session-local).
- **NFR-3** Accessibility: the button is focusable with a localized accessible
  name; reduced-motion honored; the highlight's existing aria-live semantics
  untouched.
- **NFR-4** Viewport observation uses passive listeners / IntersectionObserver;
  no per-frame layout work.

## Acceptance criteria

- **AC-1** Playing mid-surah, each advance leaves the highlighted ayah inside
  the viewport (centered).
- **AC-2** Scrolling away reveals the floating button; tapping it centers the
  verse and hides the button again.
- **AC-3** Manually scrolling back re-hides the button and silently resumes
  following without pressing anything.
- **AC-4** Paused audio keeps the button working out-of-view; idle/stopped
  hides it entirely.
- **AC-5** With reduced motion enabled, jumps are instant rather than
  animated.

## Out of scope

Mushaf pagination, mini-player/background playback, changes to highlight
styling, a settings toggle for follow behavior, non-reader pages.
