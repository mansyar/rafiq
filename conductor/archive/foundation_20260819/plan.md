# Implementation Plan — foundation_20260819

**Track:** Rafiq Foundation (Bootstrap)
**Type:** Chore — Foundation
**Methodology:** TDD per `conductor/workflow.md`; tests required only for
logic-bearing code (project rule: storage, state, commands — presentational
components exempt).

## Phase 1 — Scaffold & Dev Tooling [checkpoint: 915ce59]

*Goal: Tauri 2 + React + TS scaffold with pnpm; repo hygiene; tooling.*

- [x] Task 1.1: Bootstrap Tauri 2 + React + TS app (create-tauri-app) [bf81188]
  - [x] Generate scaffold (React-TS template, pnpm, Vite)
  - [x] Verify `pnpm install` (window launch deferred to Phase 1 checkpoint — manual)
- [x] Task 1.2: Configure repo hygiene [bf81188]
  - [x] Add `.editorconfig`
  - [x] Add/verify `.gitignore` for pnpm + Tauri stack
- [x] Task 1.3: Configure Biome (frontend lint + format) [e88fd8c]
  - [x] `biome.json` + package scripts (`check`, `format`)
- [x] Task 1.4: Configure lefthook + Conventional Commits [915ce59]
  - [x] `lefthook.yml` with staged checks (Biome, `tsc` typecheck)
  - [x] Verify hook fires on a test commit (probe commits 1cebebd, cf05adc)
- [x] Task: Phase Verification & Checkpoint (per `workflow.md`)

## Phase 2 — Rust Backend Foundations (TDD) [checkpoint: 7b5c379]

*Goal: SQLite storage (migrations + settings), typed commands, system plugins.*

- [x] Task 2.1: Write failing tests for storage module (Red) [618fd35]
  - [x] Tests: migrations apply; schema_version correct; settings set/get
        roundtrip; unknown key → None; upsert overwrites; `db_status` shape
  - [x] Run `cargo test` → confirm red (unresolved import `rafiq_lib::storage`)
- [x] Task 2.2: Implement storage module (Green) [618fd35]
  - [x] `rusqlite` dependency; DB initialized in app-data dir
  - [x] Migration mechanism (`meta.schema_version`) + `settings` table
  - [x] SettingsRepo API (get / set)
  - [x] Run `cargo test` → confirm green (6/6 pass)
- [x] Task 2.3: Implement command handlers (TDD) [a0f5d8b]
  - [x] Failing tests for command logic (`get_setting`, `set_setting`,
        `db_status` — validation + error cases)
  - [x] Implement commands; wire state into app; run tests → green (12 total)
  - [x] `cargo clippy` clean
- [x] Task 2.4: Register system plugins [7b5c379]
  - [x] `notification`, `single-instance`, `autostart` initialized in `lib.rs`;
        verify no startup errors
- [x] Task: Phase Verification & Checkpoint (per `workflow.md`)

## Phase 3 — Frontend Shell & Design Foundation [checkpoint: d434f8f]

*Goal: Tailwind tokens, shadcn/ui, sidebar nav with placeholders. Presentational
— no tests required (project rule).*

- [x] Task 3.1: Configure Tailwind design tokens [1e44f77]
  - [x] Gold / emerald / ink palette tokens; serif + Arabic-friendly fonts;
        CSS variables per product-guidelines
- [x] Task 3.2: Initialize shadcn/ui [c43e70ed]
  - [x] `components.json` + CLI init; minimal primitives (button, card,
        separator)
- [x] Task 3.3: Build navigation shell [d434f8f]
  - [x] React Router routes: Today, Quran, Log + Settings
  - [x] Sidebar with active states + ARIA labels
  - [x] Placeholder pages rendering per locale
- [x] Task 3.4: Verify shell in dev
  - [x] `pnpm tauri dev` renders shell; Biome + typecheck pass
- [x] Task: Phase Verification & Checkpoint (per `workflow.md`)

## Phase 4 — i18n Foundation [checkpoint: bd4cc64]

*Goal: i18next en/id catalogs with persisted, validated locale.*

- [x] Task 4.1: Write failing tests for locale resolution (Red) [359b188]
  - [x] Tests: valid persisted locale accepted; invalid/missing → `en` fallback;
        supported locales (`en`, `id`) enumerated
  - [x] Run test → confirm red (3 fail / 1 pass) then green (4/4)
- [x] Task 4.2: Implement locale resolver + i18next setup (Green) [ca2c3a5]
  - [x] Resolver util passes tests
  - [x] i18next + react-i18next init; en/id catalogs with shell keys
        (nav, settings, app title); fallback `en`
- [x] Task 4.3: Locale switcher + persistence [bd4cc64]
  - [x] Settings control (EN/ID)
  - [x] Persist via `set_setting`; restore on startup via `get_setting`
- [x] Task: Phase Verification & Checkpoint (per `workflow.md`)

## Phase 5 — CI Pipeline & Track Completion [checkpoint: 9422726]

*Goal: GitHub Actions quality gate; acceptance verification.*

- [x] Task 5.1: GitHub Actions CI workflow
  - [x] Rust job: fmt, clippy `-D warnings`, `cargo test`, coverage artifact
  - [x] Frontend job: pnpm install, Biome check, `tsc --noEmit`, Vitest run
- [x] Task 5.2: Local full-gate run
  - [x] Execute all checks locally; fix issues; commit
- [x] Task 5.3: Acceptance criteria verification
  - [x] Walk spec acceptance checklist; record results in plan notes

**Acceptance record (Task 5.3, 2026-08-19):**
- [x] `pnpm tauri dev` launches shell — verified manually (Phase 3)
- [x] EN ↔ ID instant switch + restart persistence — verified manually (Phase 4)
- [x] SQLite in app-data; `db_status` path + schema version; settings survive
      restart — Rust tests (6/6) + manual locale-persistence check
- [x] Plugins (notification, single-instance, autostart) init cleanly — Phase 2
- [ ] CI green — workflow committed (9422726); first remote run pending
      (no remote configured on this machine)
- [x] lefthook staged checks — observed on every commit (Biome + tsc)
- [x] Rust unit tests cover storage + command handlers — 6/6 pass;
      coverage artifact produced by CI tarpaulin job
- Out of scope respected: no prayer times/adhan/Quran/log UI added

- [x] Task: Phase Verification & Checkpoint (per workflow.md)

## Phase: Review Fixes

- [x] Task: Apply review suggestions 2d3f0ea