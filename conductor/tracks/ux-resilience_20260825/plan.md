# Plan — UX polish: Error Resilience & Feedback

Track ID: `ux-resilience_20260825` · Type: Chore / polish · Date: 2026-08-25

TDD-first, per `conductor/workflow.md`. Frontend-only track (no Rust changes).

## Phase 1 — Shared `QueryError` component & i18n foundation [checkpoint: c703c87]

- [x] Task: Write failing component tests for `QueryError` [c703c87]
  - [x] Tests: renders localized message + Retry button with `role="alert"`; button disabled while refetching; click calls `refetch()`; keyboard accessible
  - [x] Confirm tests fail (Red phase)
- [x] Task: Implement `src/components/query-error.tsx` [c703c87]
  - [x] Green: component passes tests; styled with existing `ui/button` + `text-destructive` patterns
- [x] Task: Add shared i18n keys (`common.retry`, `common.logging`, error strings) to `en.json` + `id.json` [c703c87]
  - [x] Verify parity via existing `locale.test.ts` (keys added to both files, no placeholder drift) — added a structural parity test (identical key paths + placeholder-token match) backing AC-7
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2 — Sticky error states: every page recovers [checkpoint: 405de87]

- [x] Task: Today page — single error branch (405de87)
  - [x] Collapse duplicate error paragraphs into one `QueryError` wired to `times.refetch()` + `resolved.refetch()`
  - [x] Guard "set your location" banner with `!isError` (never misleads on failure)
- [x] Task: Daily reflection card — friendly copy + retry (405de87)
  - [x] Map known failures to localized messages (no raw `String(error)`); wire `daily.refetch()`
- [x] Task: Log analytics — `isError` branch (405de87)
  - [x] Replace eternal "Loading…" fallback with `QueryError` + retry
- [x] Task: Calendar — `todayHijri` failure state (405de87)
  - [x] Include `todayQuery.isError` in error handling; render `QueryError` + retry instead of blank body
- [x] Task: Upcoming events strip — error + retry row (405de87)
  - [x] On error: stable card with `QueryError` + retry (empty state still hides)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — Silent failure fixes

- [x] Task: Update banner install-failure state (TDD) (315eeed)
  - [x] Failing tests in `update-store.test.ts`: `kind === 'error'` remains visible/actionable; retry action re-triggers install; banner test updated
  - [x] Implement: store exposes retry; banner renders "Try again" error state, never auto-dismisses on failure
- [x] Task: Adhan player blocked-playback notice (c0f4128)
  - [x] Component test: `play()` rejection surfaces visible notice
  - [x] Implement non-intrusive notice (reuse existing i18n); keep next-prayer retry behavior
- [x] Task: Recitation playback errors → store error path (TDD) (1713e0c)
  - [x] Failing tests in `player-store.test.ts`: playback failure transitions status to error with retry
  - [x] Wire `<audio onError>` + `play().catch()` into store error path; footer shows retry
- [x] Task: Settings toggles — pending + inline error (b5a423e)
  - [x] Disable toggle while mutation pending; inline error text on `onError` (notifications / adhan / autostart)
- [ ] Task: Quran translation switcher — pending + inline error
  - [ ] Disable group while `translationMutation.isPending`; surface failure inline
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Double-submit guards & i18n leak

- [ ] Task: Prayer prompt pending state (TDD)
  - [ ] Test: button disabled + "Logging…" while `logPrayer` in flight; no double submission
  - [ ] Implement `isSubmitting` state in `prayer-prompt.tsx`
- [ ] Task: Log delete cancel path (TDD)
  - [ ] Tests: arm → confirm → cancel resets; Escape/blur resets; no accidental delete
  - [ ] Implement explicit cancel affordance in `log.tsx`
- [ ] Task: Location picker double-save guard + i18n
  - [ ] Disable city result buttons + manual save while `locationMutation.isPending`
  - [ ] Replace hardcoded `'Enter valid numbers'` with `settings.locationInvalidNumbers` key (EN + ID)
- [ ] Task: i18n parity gate
  - [ ] Run `locale.test.ts` + add any missing keys; verify zero hardcoded user-facing strings (grep)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5 — Full gate, docs & completion

- [ ] Task: Full frontend gate
  - [ ] `pnpm check` (Biome lint + format), typecheck, full Vitest suite, coverage >80%
- [ ] Task: Update `CHANGELOG.md` [Unreleased] with resilience/polish summary
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
