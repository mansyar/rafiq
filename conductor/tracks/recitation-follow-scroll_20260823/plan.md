# Implementation Plan — Recitation follow-scroll

**Track:** `recitation-follow-scroll_20260823` · **Spec:** [./spec.md](./spec.md)

Sequencing rationale: the follow/suspend decision logic is extracted as pure,
DOM-free code first so the strict TDD gate applies before any wiring; reader
integration and the floating button land next; Playwright closes the loop on
real scrolling behavior that unit tests cannot see.

## Phase 1 — Follow-scroll decision logic (TDD)

- [x] Task: Follow-state machine — following ⇄ suspended via user-scrolled-away / active-in-view / button-tapped / reset events; idle-safe no-ops — tests first (`src/lib/follow-scroll.ts`) (ed0f989)
- [x] Task: Reduced-motion scroll-behavior helper (`scrollBehaviorFor`) — tests first (ed0f989)
- [x] Task: Verify coverage (>80% changed logic) & quality gates (biome, tsc)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) (ed0f989)

## Phase 2 — Reader integration & floating jump button

- [x] Task: Wire overlap detection (IntersectionObserver) + auto-center effect into `quran-reader.tsx` through the machine (FR-1/FR-2/FR-4); reset on stop/new play/surah navigation (946ef07)
- [x] Task: Floating "Jump to reciting ayah" pill with EN/ID catalog keys (FR-3) (946ef07)
- [x] Task: i18n parity check + accessibility review of the new control (946ef07)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — E2E coverage

- [ ] Task: `e2e/recitation.spec.ts` — new describe covering AC-1..AC-4 with fixture audio
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
