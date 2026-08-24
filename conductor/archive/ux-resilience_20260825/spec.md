# Spec — UX polish: Error Resilience & Feedback

Track ID: `ux-resilience_20260825` · Type: Chore / polish · Date: 2026-08-25

## Overview

Hardens Rafiq's failure UX: every error path becomes visible, localized, and
recoverable; no action can silently fail or be double-submitted. Rooted in the
UX audit (2026-08-25). The systemic issue: `QueryClient` is configured with
`retry: 1` and `refetchOnWindowFocus: false`, and error branches are read-only
paragraphs — a single transient Tauri command failure permanently bricks a view
until the app restarts. Several mutations and audio playbacks also fail
silently.

## Functional Requirements

### FR-1 — Shared error/retry component (`QueryError`)

- Reusable component: localized message + "Retry" button; `role="alert"`
  semantics; button disabled while refetching; calls the query's `refetch()`
  for a fresh attempt.
- Applied to every query error branch: **Today** (prayer times + resolved
  location), **daily reflection card**, **Log analytics**, **Calendar**,
  **upcoming events strip**.

### FR-2 — Fix sticky / misleading error states

- **Today**: collapse duplicate error paragraphs into one `QueryError` wired
  to `times.refetch()` + `resolved.refetch()`; guard the "set your location"
  banner with `!isError` so it never shows on failure.
- **Daily reflection card**: friendly localized message (no raw
  `String(error)` dumping) + Retry via `daily.refetch()`.
- **Log analytics**: real `isError` branch with message + Retry — never an
  eternal "Loading…" fallback.
- **Calendar**: `todayHijri` failure renders error + Retry instead of a
  silently blank body.
- **Upcoming events strip**: on error, render a stable error + Retry row
  (never vanish); empty state unchanged (still hides).

### FR-3 — Fix silent failures

- **Update banner**: install failure keeps the banner visible with a
  "Try again" action; the store's `kind === 'error'` state no longer hides it.
- **Adhan player**: `play()` rejection surfaces a non-intrusive in-app notice
  ("Adhan playback was blocked"); next-prayer retry behavior preserved.
- **Recitation player**: wire `<audio onError>` + `play().catch()` into the
  store's existing error/retry path — no more "playing" with no sound.
- **Settings toggles** (notifications / adhan / autostart): disabled + pending
  state while saving; inline error text on failure.
- **Quran translation switcher**: buttons disabled while
  `translationMutation.isPending`; inline error on failure.

### FR-4 — Double-submit guards

- **Prayer prompt** "I prayed": `isSubmitting` state — button disabled with a
  "Logging…" label while `logPrayer` is in flight.
- **Log delete**: explicit cancel path (arm → confirm, Escape/blur resets,
  cancel action available).
- **Location picker**: city result buttons + manual save disabled while
  `locationMutation.isPending`.

### FR-5 — i18n

- Replace hardcoded `'Enter valid numbers'` with a catalog key (EN + ID).
- All new strings (retry, logging, errors) in the catalog with EN/ID parity;
  no hardcoded user-facing strings.

## Non-Functional Requirements

- NFR-1: No change to global `QueryClient` retry policy (`retry: 1` stays;
  recovery is user-driven via the Retry button).
- NFR-2: A11y — error states announced (`role="alert"`/`aria-live`), pending
  states use `disabled`/`aria-busy`, retry buttons keyboard-accessible.
- NFR-3: Happy paths unchanged — zero behavioral change when no errors occur;
  all existing tests keep passing.
- NFR-4: Follow existing design tokens + `components/ui/*` primitives; reuse
  existing i18n namespaces.
- NFR-5: Frontend-only track — no Rust changes.

## Acceptance Criteria

- AC-1: Every query error branch listed in FR-1/FR-2 renders a localized
  message + working Retry that recovers.
- AC-2: Update banner shows "Try again" on install failure; success path
  resumes the normal flow.
- AC-3: Adhan play rejection shows a visible notice.
- AC-4: Recitation playback failure transitions to the store error state with
  retry — never stuck at "playing".
- AC-5: Toggles + translation switcher disable while pending and show inline
  errors.
- AC-6: No double-submit possible: prayer prompt, log delete (with cancel),
  location picker.
- AC-7: No hardcoded user-facing strings; EN/ID parity verified
  programmatically.
- AC-8: Unit/component tests cover new logic (QueryError, update-store,
  player-store, guards); full frontend suite passes; E2E untouched.

## Out of Scope

- Loading skeletons / placeholder states (separate track)
- Route scroll reset & list-position restore (separate track)
- A11y tab-stop relief, skip links, onboarding focus management (separate
  track)
- Update banner "Later" dismiss
- E2E failure-injection tests
- Global retry policy / auto-retry changes
