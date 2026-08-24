# Specification — System tray & background presence

**Track:** `tray-background_20260824` · **Type:** feature · **Status:** approved draft

## Overview

Rafiq becomes a true always-on companion: closing the window keeps the app
alive in the system tray so adhan reminders and prayer-time prompts never stop,
and a new Settings toggle lets users start Rafiq at login. The tray icon offers
at-a-glance next-prayer info and full control over visibility and exit.

## Functional requirements

- **FR-1 Tray presence** — A monochrome template glyph (adapts to light/dark
  trays) appears in the system tray / notification area on Windows, macOS, and
  Linux whenever the app runs.
- **FR-2 Close-to-tray** — Intercepting the main window's close event hides
  the window instead of exiting; minimize keeps normal taskbar behavior. On
  the **first-ever** hide, an informational OS notification explains the model
  (EN *"Rafiq is still running in the system tray — adhan reminders continue.
  You can quit anytime from the tray menu."*), tracked by a persisted setting
  key so it never repeats.
- **FR-3 Tray menu** — Right-click opens a menu with exactly three items:
  1. *Next-prayer info row* (disabled): `"Next: Asr · 16:12"` when location +
     method are configured; otherwise the placeholder *"Complete setup in
     Rafiq"*. Refreshed on a slow tick (~30 s) while running.
  2. *Show Rafiq* — restores and focuses the window.
  3. *Quit Rafiq* — fully exits the process (tray icon removed, scheduler
     stopped).
- **FR-4 Left-click** — Shows/focuses the main window (Windows convention;
  right-click opens the menu).
- **FR-5 Tooltip** — Hovering shows `"Rafiq — Next: Asr 16:12"`, refreshed
  with the same tick as FR-3.
- **FR-6 Single-instance restore** — Launching a second instance restores and
  focuses the existing window even if it is hidden in the tray (upgrades the
  current focus-only handler).
- **FR-7 Launch-at-login toggle** — New Settings card control wired to the
  already-integrated autostart plugin; default **off**; reflects and controls
  the OS registration state.

## Non-functional requirements

- **NFR-1** All user-visible strings (hint notification, tray items, tooltip,
  placeholder) live in the single i18n catalog EN + ID with parity; localized
  labels are handed to the Rust tray layer on startup and on language change
  (no duplicated copy in Rust).
- **NFR-2** No new network calls; tray icon ships as a bundled asset; no
  telemetry or OS permissions beyond standard notification use.
- **NFR-3** Countdown refresh is a single low-frequency tick driven by the
  existing scheduler data path (`get_next_prayer`) — no busy polling, no
  per-second timers.
- **NFR-4** Pure logic (close-policy decision, tray-menu model construction,
  countdown formatting, autostart pref mapping) is unit-tested TDD-first;
  target >80% coverage on new modules. OS-level tray visuals verified via a
  documented manual smoke checklist per OS.
- **NFR-5** Quit is immediate and unconfirmed; no dialogs block exit.

## Acceptance criteria

- **AC-1** Clicking X hides the window; at the next prayer time the adhan and
  in-app log prompt still fire while hidden.
- **AC-2** The explainer notification appears exactly once across app
  restarts; later hides are silent.
- **AC-3** The tray menu info row shows the correct next prayer name and time,
  rolling over correctly past midnight and after all prayers pass.
- **AC-4** Left-click, tray "Show Rafiq", and a second app launch each restore
  the hidden window focused.
- **AC-5** Quit removes the tray icon and ends the process cleanly (no zombie
  scheduler thread).
- **AC-6** With onboarding incomplete, the placeholder row shows; completing
  setup swaps it for the live countdown without relaunch.
- **AC-7** The Settings toggle toggles launch-at-login and its state survives
  restart.
- **AC-8** The minimize button minimizes to the taskbar normally and never
  hides to tray.

## Out of scope

Adhan mute quick-toggle in the tray, stateful/dual icons, close-behavior
preference dialog ("ask every time"), macOS dock hiding, auto-relaunch after
quit, mobile platforms.
