# Implementation Plan — Onboarding First-Run Flow

**Track:** `onboarding-first-run_20260821`
**Plan:** Created 2026-08-21

## Phase 1 — Onboarding Logic Foundation (TDD)

- [x] Task: Write failing tests for onboarding helpers (Red) (2442460)
    - [ ] Create `src/lib/onboarding.test.ts`: `isOnboardingComplete()` flag parsing, `detectSystemLocale()` mapping (`id*` → `id`, else `en`), wizard step machine (`next`/`back`/step ordering)
    - [ ] Run `CI=true pnpm vitest run` — confirm failures
- [x] Task: Implement `src/lib/onboarding.ts` to pass (Green) (2442460)
    - [ ] Flag helpers + system-locale detection + step state machine
    - [ ] Refactor if needed; rerun tests
- [x] Task: Verify coverage of new module ≥80% and commit (2442460)
    - [ ] `pnpm vitest run --coverage`; commit `feat(onboarding): add onboarding flag, locale-detection and step-machine helpers`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2 — Route, Guard & Wizard Shell

- [ ] Task: Wire `/onboarding` route outside `Layout` in `App.tsx`
    - [ ] Initial-load guard: read `get_setting('onboarding_complete')`; absent/false → redirect from `Today` to `/onboarding`
- [ ] Task: Build wizard shell component
    - [ ] Header with persistent Skip control + step progress indicator; step container with Back/Next
    - [ ] Add `onboarding.*` namespace keys to `en.json` / `id.json` (shell strings)
- [ ] Task: Commit shell + routing — `feat(onboarding): add full-screen wizard route, guard and shell`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — Wizard Steps UI

- [ ] Task: Welcome carousel (3 slides: Prayer Times+Adhan · Quran+Recitation · Prayer Log+Analytics)
    - [ ] Dot indicators, keyboard navigation, gold/emerald tokens + geometric motifs
- [ ] Task: Language step
    - [ ] EN/ID cards; preselect via `detectSystemLocale`; apply live (`i18n.changeLanguage`) + persist `set_setting('locale')` immediately
- [ ] Task: Location step
    - [ ] Extract shared debounced city-search + manual lat/lon entry from `settings.tsx` into a reusable component; reuse in both Settings and wizard (no duplication)
    - [ ] Inline validation errors; prefill from `get_resolved_location` when re-running
- [ ] Task: Calculation method step
    - [ ] 7 methods from `CALCULATION_METHODS`, MWL preselected; persist `set_setting('prayer_calculation_method')`
- [ ] Task: Finish & Skip handlers
    - [ ] Both write `onboarding_complete` via `set_setting` then navigate to `Today`
- [ ] Task: Complete `onboarding.*` catalogs (EN + ID key-identical); commit — `feat(onboarding): implement welcome, language, location and method steps`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Settings Re-run Entry

- [ ] Task: Add prominent "Run setup again" action at top of Settings page
    - [ ] Navigates to `/onboarding`; abandoning mid-rerun changes nothing but explicit edits
    - [ ] Catalog keys under `settings.*`
- [ ] Task: Commit — `feat(settings): add run-setup-again onboarding entry`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5 — Final Verification & Quality Gate

- [ ] Task: Run full gate — Biome, `tsc --noEmit`, `CI=true pnpm vitest run --coverage`
- [ ] Task: Manual verification pass against AC-1…AC-8 (fresh-state launch, locale preselect, complete flow, skip flow, mid-wizard quit, re-run)
- [ ] Task: Remove nothing unrelated; confirm no regressions in existing suites
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
