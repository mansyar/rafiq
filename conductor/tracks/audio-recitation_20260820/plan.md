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

## Phase 2: Audio Index & Ayah Mapping (Rust) *(FR-2.4, FR-2.1)* [checkpoint: f64b590]
- [x] Task: Write failing tests for recitation audio index & mapping *(Red)* (d08e5a8)
  - [x] Tests: `recitation` table schema, insert/lookup of cached files, size + fetched-at tracking
  - [x] Tests: (surah, ayah) → global ayah number mapping from bundled Quran metadata (boundary cases: first/last ayah, 6236)
- [x] Task: Implement audio index & mapping *(Green)* (f64b590)
  - [x] Add `recitation` table + `RecitationRepo` to `src-tauri/src/storage/`
  - [x] Add global-ayah mapping to `src-tauri/src/quran/` (reuses bundled surah metadata)
- [x] Task: Refactor & verify coverage >80% for new modules (f64b590)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — f64b590

## Phase 3: On-Demand Download & Cache (Rust) *(FR-2.1–FR-2.3)* [checkpoint: 0b098d8]
- [x] Task: Write failing tests for fetch/cache logic *(Red)* (6cae9e3)
  - [x] Tests: per-ayah CDN URL construction (128 kbps, edition, global number)
  - [x] Tests: cache state machine — missing → downloading → cached; valid cache never re-fetched; partial/corrupt files re-fetch; atomic writes (temp + rename)
- [x] Task: Implement on-demand fetch *(Green)* (0b098d8)
  - [x] `reqwest` download to temp file, atomic rename into app-data `recitation/` directory
  - [x] Update `RecitationRepo` on success; failure leaves state as missing
- [x] Task: Refactor & verify coverage >80% (0b098d8)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — 0b098d8

## Phase 4: Tauri Commands & Frontend API *(FR-2.2, FR-3 support)* [checkpoint: 3c0e88e]
- [x] Task: Write failing tests for player state logic *(Red)* — a1287eb
  - [x] Frontend tests: player state machine (idle → fetching(progress) → playing → paused → stopped), position persistence triggers, bounded lookahead requests
- [x] Task: Implement Rust commands + frontend API *(Green)* — 3c0e88e
  - [x] Commands in `commands.rs`: `get_recitation_state(surah)` (cached ayahs, last-played ayah, availability), `fetch_ayah_audio(global_ayah)` → local path, `report_played_position(surah, ayah)`, local-file URL helper for `<audio>` (implemented frontend-side as `localAudioUrl` via `convertFileSrc` + `assetProtocol` scope — Tauri 2 idiom)
  - [x] Typed API + TanStack Query hooks + Zustand player store in `src/lib/`
- [x] Task: Refactor & verify coverage >80% — 3c0e88e
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — 3c0e88e

## Phase 5: Reader Player UI *(FR-3, FR-4, NFR-4, NFR-5)* [checkpoint: 9565986]
- [x] Task: Player footer & surah header controls (810ea88)
  - [x] Footer: play/pause, stop, current position (surah:ayah), download progress, reciter name
  - [x] Header play/pause starts from last-played ayah, or ayah 1 if none
- [x] Task: Click-ayah-to-play & current-ayah highlight (810ea88)
  - [x] Clicking an ayah block starts from that ayah; highlight (Arabic + translation columns) advances with playback
- [x] Task: Position & navigation behavior (810ea88)
  - [x] Persist last-played ayah on progression/unmount; navigate away pauses, return resumes
- [x] Task: i18n strings `quran.audio.*` (EN + ID catalogs) (810ea88)
- [x] Task: Accessibility & design pass (ARIA labels, keyboard operable, gold/emerald tokens, no emojis adjacent to Arabic) (810ea88)
  - [x] Post-verification fix: asset protocol required `assetProtocol.enable: true` + `protocol-asset` Cargo feature for `<audio>` playback of cached files (9565986)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — 9565986

## Phase 6: Offline, Failure & Release Gate *(FR-5, AC-5–AC-8)*
- [ ] Task: Write failing tests for offline & failure paths *(Red)*
  - [ ] Tests: fully cached surah plays without network; failure → calm error state + retry; cached ayahs unaffected by failure
- [ ] Task: Implement/verify offline & failure UX *(Green)*
  - [ ] Calm retry message + action in reader footer; play state reflects availability
- [ ] Task: Full gate & docs sync
  - [ ] `cargo test` + `cargo clippy`, `biome`, `tsc --noEmit`, `vitest` all pass; coverage >80% for all new logic modules
  - [ ] Update `conductor/tech-stack.md` + `ATTRIBUTION.md` if design or license findings changed during implementation
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
