# Implementation Plan — Audio Recitation

**Track:** `audio-recitation_20260820`
**Spec:** Approved 2026-08-20

## Phase 1: License Verification & Content Gate *(FR-1.2, FR-1.3, AC-7)* [checkpoint: d2f1620]
- [x] Task: Verify recitation audio source license (d2f1620)
  - [x] Verify Islamic Network CDN terms + Mishary Alafasy recitation rights; record source and date
  - [x] If verifiable: document license in `src-tauri/assets/ATTRIBUTION.md`
  - [-] Fallback: not triggered — license verified 2026-08-20 (contingency edition documented)
- [x] Task: Document audio design in tech stack *(workflow: stack changes before implementation)* (d2f1620)
  - [x] Add dated note to `conductor/tech-stack.md`: recitation source (CDN pattern, edition, bitrate) and local cache directory design
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — d2f1620

## Phase 2: Audio Index & Ayah Mapping (Rust) *(FR-2.4, FR-2.1)*
- [~] Task: Write failing tests for recitation audio index & mapping *(Red)*
  - [ ] Tests: `recitation` table schema, insert/lookup of cached files, size + fetched-at tracking
  - [ ] Tests: (surah, ayah) → global ayah number mapping from bundled Quran metadata (boundary cases: first/last ayah, 6236)
- [ ] Task: Implement audio index & mapping *(Green)*
  - [ ] Add `recitation` table + `RecitationRepo` to `src-tauri/src/storage/`
  - [ ] Add global-ayah mapping to `src-tauri/src/quran/` (reuses bundled surah metadata)
- [ ] Task: Refactor & verify coverage >80% for new modules
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: On-Demand Download & Cache (Rust) *(FR-2.1–FR-2.3)*
- [ ] Task: Write failing tests for fetch/cache logic *(Red)*
  - [ ] Tests: per-ayah CDN URL construction (128 kbps, edition, global number)
  - [ ] Tests: cache state machine — missing → downloading → cached; valid cache never re-fetched; partial/corrupt files re-fetch; atomic writes (temp + rename)
- [ ] Task: Implement on-demand fetch *(Green)*
  - [ ] `reqwest` download to temp file, atomic rename into app-data `recitation/` directory
  - [ ] Update `RecitationRepo` on success; failure leaves state as missing
- [ ] Task: Refactor & verify coverage >80%
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Tauri Commands & Frontend API *(FR-2.2, FR-3 support)*
- [ ] Task: Write failing tests for player state logic *(Red)*
  - [ ] Frontend tests: player state machine (idle → fetching(progress) → playing → paused → stopped), position persistence triggers, bounded lookahead requests
- [ ] Task: Implement Rust commands + frontend API *(Green)*
  - [ ] Commands in `commands.rs`: `get_recitation_state(surah)` (cached ayahs, last-played ayah, availability), `fetch_ayah_audio(global_ayah)` → local path, `report_played_position(surah, ayah)`, local-file URL helper for `<audio>`
  - [ ] Typed API + TanStack Query hooks + Zustand player store in `src/lib/`
- [ ] Task: Refactor & verify coverage >80%
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5: Reader Player UI *(FR-3, FR-4, NFR-4, NFR-5)*
- [ ] Task: Player footer & surah header controls
  - [ ] Footer: play/pause, stop, current position (surah:ayah), download progress, reciter name
  - [ ] Header play/pause starts from last-played ayah, or ayah 1 if none
- [ ] Task: Click-ayah-to-play & current-ayah highlight
  - [ ] Clicking an ayah block starts from that ayah; highlight (Arabic + translation columns) advances with playback
- [ ] Task: Position & navigation behavior
  - [ ] Persist last-played ayah on progression/unmount; navigate away pauses, return resumes
- [ ] Task: i18n strings `quran.audio.*` (EN + ID catalogs)
- [ ] Task: Accessibility & design pass (ARIA labels, keyboard operable, gold/emerald tokens, no emojis adjacent to Arabic)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 6: Offline, Failure & Release Gate *(FR-5, AC-5–AC-8)*
- [ ] Task: Write failing tests for offline & failure paths *(Red)*
  - [ ] Tests: fully cached surah plays without network; failure → calm error state + retry; cached ayahs unaffected by failure
- [ ] Task: Implement/verify offline & failure UX *(Green)*
  - [ ] Calm retry message + action in reader footer; play state reflects availability
- [ ] Task: Full gate & docs sync
  - [ ] `cargo test` + `cargo clippy`, `biome`, `tsc --noEmit`, `vitest` all pass; coverage >80% for all new logic modules
  - [ ] Update `conductor/tech-stack.md` + `ATTRIBUTION.md` if design or license findings changed during implementation
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
