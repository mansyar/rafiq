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

## Phase 2 — Rust Backend Foundations (TDD)

*Goal: SQLite storage (migrations + settings), typed commands, system plugins.*

- [ ] Task 2.1: Write failing tests for storage module (Red)
  - [ ] Tests: migrations apply; schema_version correct; settings set/get
        roundtrip; unknown key → None; upsert overwrites; `db_status` shape
  - [ ] Run `cargo test` → confirm red
- [ ] Task 2.2: Implement storage module (Green)
  - [ ] `rusqlite` dependency; DB initialized in app-data dir
  - [ ] Migration mechanism (`meta.schema_version`) + `settings` table
  - [ ] SettingsRepo API (get / set)
  - [ ] Run `cargo test` → confirm green
- [ ] Task 2.3: Implement command handlers (TDD)
  - [ ] Failing tests for command logic (`get_setting`, `set_setting`,
        `db_status` — validation + error cases)
  - [ ] Implement commands; wire state into app; run tests → green
  - [ ] `cargo clippy` clean
- [ ] Task 2.4: Register system plugins
  - [ ] `notification`, `single-instance`, `autostart` initialized in `lib.rs`;
        verify no startup errors
- [ ] Task: Phase Verification & Checkpoint (per `workflow.md`)

## Phase 3 — Frontend Shell & Design Foundation

*Goal: Tailwind tokens, shadcn/ui, sidebar nav with placeholders. Presentational
— no tests required (project rule).*

- [ ] Task 3.1: Configure Tailwind design tokens
  - [ ] Gold / emerald / ink palette tokens; serif + Arabic-friendly fonts;
        CSS variables per product-guidelines
- [ ] Task 3.2: Initialize shadcn/ui
  - [ ] `components.json` + CLI init; minimal primitives (button, card,
        separator)
- [ ] Task 3.3: Build navigation shell
  - [ ] React Router routes: Today, Quran, Log + Settings
  - [ ] Sidebar with active states + ARIA labels
  - [ ] Placeholder pages rendering per locale
- [ ] Task 3.4: Verify shell in dev
  - [ ] `pnpm tauri dev` renders shell; Biome + typecheck pass
- [ ] Task: Phase Verification & Checkpoint (per `workflow.md`)

## Phase 4 — i18n Foundation

*Goal: i18next en/id catalogs with persisted, validated locale.*

- [ ] Task 4.1: Write failing tests for locale resolution (Red)
  - [ ] Tests: valid persisted locale accepted; invalid/missing → `en` fallback;
        supported locales (`en`, `id`) enumerated
  - [ ] Run test → confirm red
- [ ] Task 4.2: Implement locale resolver + i18next setup (Green)
  - [ ] Resolver util passes tests
  - [ ] i18next + react-i18next init; en/id catalogs with shell keys
        (nav, settings, app title); fallback `en`
- [ ] Task 4.3: Locale switcher + persistence
  - [ ] Settings control (EN/ID)
  - [ ] Persist via `set_setting`; restore on startup via `get_setting`
- [ ] Task: Phase Verification & Checkpoint (per `workflow.md`)

## Phase 5 — CI Pipeline & Track Completion

*Goal: GitHub Actions quality gate; acceptance verification.*

- [ ] Task 5.1: GitHub Actions CI workflow
  - [ ] Rust job: fmt, clippy `-D warnings`, `cargo test`, coverage artifact
  - [ ] Frontend job: pnpm install, Biome check, `tsc --noEmit`, Vitest run
- [ ] Task 5.2: Local full-gate run
  - [ ] Execute all checks locally; fix issues; commit
- [ ] Task 5.3: Acceptance criteria verification
  - [ ] Walk spec acceptance checklist; record results in plan notes
- [ ] Task: Phase Verification & Checkpoint (per `workflow.md`)