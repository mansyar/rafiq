# Implementation Plan — System tray & background presence

**Track:** `tray-background_20260824` · **Spec:** [./spec.md](./spec.md)

Sequencing rationale: pure decision/formatting logic lands first so the strict
TDD gate applies before any OS wiring; the Rust tray runtime comes next with
English defaults plus a label-update seam; the frontend then supplies localized
labels and the Settings autostart card; a documented manual smoke matrix closes
the loop since OS trays cannot be scripted by Playwright.

## Phase 1 — Pure tray/background logic (TDD)

- [x] Task: Next-prayer countdown formatter — `"Next: Asr · 16:12"` from scheduler data, midnight/all-prayers-passed rollover, `None` → placeholder signal — tests first (`src-tauri/src/tray/mod.rs`) (FR-3, AC-3, AC-6) (da380a8)
- [x] Task: Tray-menu model builder — localized labels + optional next-prayer info → ordered items (disabled info row / Show Rafiq / Quit Rafiq) — tests first (`src-tauri/src/tray/mod.rs`) (FR-3) (9fb54b0)
- [x] Task: Hint-once policy — read/flip persisted `tray_hint_shown` key, restart-stable — tests first (`src-tauri/src/tray/mod.rs`) (FR-2, AC-2) (c83cd1f)
- [x] Task: Verify coverage (>80% changed logic) & quality gates (clippy, cargo test) (c83cd1f: clippy clean, 211/211 green, llvm-cov tray 98.94%)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) (report attached as git note on c83cd1f; approved)

## Phase 2 — Tray runtime integration (Rust)

- [x] Task: Bundle monochrome template tray icon asset (light/dark adaptive) (a004005)
- [x] Task: Build tray icon + default menu in `setup`; left-click show/focus, right-click menu events (FR-1, FR-4) (32214a1)
- [x] Task: Intercept window close → hide-to-tray + one-time explainer notification through existing notification plugin; minimize untouched (FR-2, FR-8, AC-1, AC-8) (32214a1)
- [x] Task: ~30 s refresh task updating menu info row + tooltip from `get_next_prayer` data path; no busy polling (FR-3, FR-5, NFR-3) (102b7cb)
- [x] Task: `set_tray_labels` command accepting localized strings; rebuild menu live (NFR-1) (102b7cb)
- [x] Task: Upgrade `single_instance` handler → show + focus hidden window (FR-6, AC-4) (102b7cb)
- [x] Task: Quit path exits process cleanly — tray dropped, scheduler thread terminated (AC-5, NFR-5) (32214a1)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) (report attached as git note on 102b7cb; approved)

## Phase 3 — Localized labels & Settings autostart card (frontend)

- [x] Task: i18n catalog keys EN + ID (tray items, tooltip, placeholder, hint notification, settings labels) with parity check (NFR-1) (78cb0b9)
- [x] Task: Send localized labels on startup and on language change via `set_tray_labels` (NFR-1, AC-6) (78cb0b9)
- [x] Task: "Launch at login" toggle in Settings General area wired to autostart plugin enable/disable, reflecting current registration state, off by default — lib tests first per repo convention (tauri-driver n/a; plugin mocked in vitest) (`src/pages/settings.tsx`, `src/lib/autostart.ts`) (FR-7, AC-7) (fd6c25c)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) (report attached as git note on fd6c25c; approved)

## Phase 4 — Smoke documentation & final gate

- [x] Task: Manual smoke checklist (Windows/macOS/Linux) walking through AC-1..AC-8, stored in the track folder (NFR-4) ([./smoke-checklist.md](./smoke-checklist.md); Windows executed during the track)
- [x] Task: Full quality gate — fmt, clippy, biome, tsc, cargo test, vitest, production build (2026-08-24: fmt clean; clippy clean; cargo 211+6 green; biome 63 files clean; tsc clean; vitest 209/209; vite build ok 7.5s)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
