# Technology Stack — Rafiq

## Architecture
Desktop application built with **Tauri 2**: Rust backend core + OS-native
webview frontend (WebView2 on Windows, WKWebView on macOS, WebKitGTK on Linux).

## Frontend
- **Framework:** React + TypeScript (strict mode)
- **Package manager:** **pnpm**
- **Build tooling:** Vite + @tauri-apps/cli
- **Styling:** Tailwind CSS with design tokens (gold / emerald / ink palette) +
  shadcn/ui component primitives
- **i18n:** Catalog-based system (e.g., i18next) — English + Indonesian
- **State:** Lightweight state management (e.g., Zustand) + TanStack Query for
  async backend commands
- **Audio:** HTML5 `<audio>` for recitation and adhan playback
- **Arabic:** Native webview RTL/bidi rendering; bundled Arabic fonts
  (e.g., Amiri) for Quranic text

## Backend (Rust core)
- **Framework:** Tauri 2 (typed commands + events)
- **Prayer times:** the crates.io `adhaan` package (imported as `adhan`) — all
  7 standard methods, MWL default
- **Date handling:** `chrono` for command-facing calendar dates and serialization;
  `jiff` for `adhaan` calculation instants and UTC formatting
- **Hijri calendar:** Umm al-Qura conversion (crate or bespoke implementation)
- **Storage:** SQLite via `rusqlite` behind Rust commands (prayer logs, streaks,
  settings, audio index)
- **Networking:** `reqwest` for on-demand audio downloads; local cache directory
- **System integration:** `tauri-plugin-notification` (prayer/adhan alerts);
  `tauri-plugin-autostart`, `tauri-plugin-single-instance`,
  `tauri-plugin-updater` (auto-updates via GitHub Releases)
  > **Note (2026-08-20):** `tauri-plugin-notification` 2.3.3's desktop path is
  > a plain `notify_rust` wrapper — no action-button API and no click/action
  > events (all action APIs are mobile-only; verified in the plugin source). OS
  > notifications stay informational on desktop; prayer-time one-tap logging is
  > delivered as an in-app prompt driven by the scheduler's `prayer-fired`
  > event (prayer-log-analytics track spec, amendment 2026-08-20).

## Data & Content
- **City DB:** bundled ~3,000 cities (embedded SQLite/JSON asset, shipped with
  installer) + manual lat/long fallback
- **Quran text + translations:** bundled local assets (Tanzil-format Quran text,
  JSON translations: Sahih International, The Clear Quran, Kemenag)
- **Recitation:** Mishary Alafasy, download-on-demand, cached forever locally
- **Licensing:** per `product.md` Content Licensing Notes

## Dev Tools
- **Bootstrap:** create-tauri-app scaffold + shadcn/ui CLI (via pnpm)
- **Lint & format:** Rust — `cargo fmt` + `clippy` (warnings denied in CI);
  Frontend — **Biome** (lint + format + import organization)
- **Git hooks:** **lefthook** running staged checks (format, lint, typecheck) +
  **Conventional Commits**
- **CI/CD:** GitHub Actions — PR gate (fmt, clippy, biome, typecheck, tests,
  coverage) + release workflow via `tauri-action` on version tags producing
  Win/macOS/Linux artifacts on GitHub Releases
- **Updates:** tauri-plugin-updater, GitHub Releases endpoint, signed artifacts

## Target Platforms
- Windows 10/11 (WebView2)
- macOS (WKWebView)
- Linux (WebKitGTK) — AppImage / deb / rpm

## Testing
- **Rust:** `cargo test` — unit tests for calculation engines and storage
- **Frontend:** Vitest + React Testing Library
- **E2E:** tauri-driver / Playwright integration — evaluated during v1

## Distribution
- GitHub Releases via `tauri-action` — Windows (.msi/.exe), macOS (.dmg),
  Linux (AppImage/.deb)
- License: MIT / Apache-2.0
