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
- **Hijri calendar:** Umm al-Qura conversion via ICU4X `icu_calendar`
  (`Hijri::new_umm_al_qura()`; civil dates, proleptic/unbounded range)
  > **Note (2026-08-20):** Adopted `icu_calendar` 2.x (ICU4X) for the
  > hijri-calendar track. The crates.io `hijri` crate is a CLI binary, not an
  > embedding library; its engine is ICU4X's Umm al-Qura rules, which are the
  > same implementation used here. Anchors verified against Umm al-Qura data:
  > 2026-06-16 = 1 Muharram 1448 AH; 1447-12-10 = 2026-05-27.
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
  > **Note (2026-08-20):** Recitation source confirmed for the
  > audio-recitation track: Islamic Network CDN, per-ayah MP3 at
  > `https://cdn.islamic.network/quran/audio/128/ar.alafasy/{global_ayah}.mp3`
  > (edition `ar.alafasy` — Mishary Rashid Alafasy Murattal, 128 kbps, global
  > ayah 1–6236 mapped from bundled Quran metadata). License verified against
  > the alquran.cloud Terms & Conditions (last updated 2026-06-14, Section IV):
  > free non-commercial redistribution; commercial bundling permitted with
  > reciter copyright retained and takedown possible. Reciter name is shown in
  > the player. Cache: `recitation/` subdirectory of the Tauri app-data
  > directory, files named by global ayah number, tracked in the SQLite audio
  > index.
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
