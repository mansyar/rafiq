# Track: Rafiq Foundation (Bootstrap)

**Track ID:** foundation_20260819
**Type:** Chore — Foundation
**Status:** new

## Overview
Bootstraps the Rafiq desktop application: a runnable Tauri 2 shell with a
React + TypeScript frontend, Tailwind CSS + shadcn/ui design foundation, a Rust
backend with SQLite storage behind typed commands, an English/Indonesian i18n
skeleton with persisted locale, sidebar navigation matching the simplicity-first
UX principle, and GitHub Actions CI enforcing the project's quality gates. Every
subsequent feature track (Prayer Times, Quran, Log, Hijri, Daily) builds on this.

## Functional Requirements

1. **Project scaffold**
   - Tauri 2 app via create-tauri-app: React + TypeScript, pnpm, Vite.
   - Rust backend in `src-tauri/`; frontend in `src/`.
2. **Runnable shell**
   - App window opens; title reflects locale: "Rafiq — Muslim Companion" /
     "Rafiq — Sahabat Muslim".
   - `pnpm tauri dev` runs cleanly on the host platform (Windows).
3. **Design foundation**
   - Tailwind configured with design tokens (gold / emerald / ink palette)
     per product-guidelines.
   - shadcn/ui initialized with minimal primitives needed by the shell.
4. **Navigation shell**
   - Left sidebar: Today, Quran, Log + Settings footer; active state;
     React Router with placeholder pages rendered per locale.
5. **Dev tooling**
   - lefthook configured (staged format/lint/typecheck), Conventional Commits,
     `.editorconfig`, `.gitignore` for the Tauri/pnpm stack.
6. **SQLite storage**
   - SQLite database created in the app-data dir via `rusqlite` in the Rust
     backend; migration mechanism (schema versioning).
   - Initial schema: `meta` (schema_version) + `settings` (key/value).
   - Typed Tauri commands: `get_setting`, `set_setting`, `db_status`
     (path + version) for a health check.
7. **i18n foundation**
   - i18next + react-i18next, en/id catalogs, fallback `en`.
   - Locale switch in Settings persists via SQLite; app restores it on startup.
8. **System plugins**
   - tauri-plugin-notification, tauri-plugin-single-instance,
     tauri-plugin-autostart registered and initializing without errors.
9. **CI**
   - GitHub Actions: Rust fmt + clippy (warnings denied) + `cargo test`;
     pnpm install, Biome check, `tsc` typecheck, Vitest; coverage artifact.
   - Coverage scope: logic-bearing Rust modules only (project testing rule).

## Non-Functional Requirements
- **Privacy:** no telemetry, no network calls at startup; all data local.
- **Performance:** cold start < 2s on typical hardware; responsive shell.
- **Accessibility:** keyboard navigation works; ARIA labels on nav.
- **Style compliance:** conductor style guides; Conventional Commits; lefthook
  hooks active.
- **Testing rule:** tests required only for logic-bearing code (storage and
  command handlers); presentational shell components exempt.

## Acceptance Criteria
- [ ] `pnpm tauri dev` launches the shell window with sidebar nav + placeholders.
- [ ] Locale switch EN ↔ ID updates UI instantly and persists across restarts.
- [ ] SQLite created in app-data; `db_status` returns schema version; settings
      survive restart.
- [ ] Notification / single-instance / autostart plugins initialize cleanly.
- [ ] CI pipeline green on the repo (fmt, clippy, biome, typecheck, tests).
- [ ] lefthook runs staged checks on commit.
- [ ] Rust unit tests cover storage + command handlers (logic-bearing only).

## Out of Scope (this track)
- Prayer times, adhan, Quran content, prayer log UI, Hijri calendar, daily
  ayah/hadith, audio recitation
- Updater plugin, release pipeline, signing (deferred to release track)
- E2E browser tests; macOS/Linux build verification (CI matrix later)