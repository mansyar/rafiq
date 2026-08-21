# Rafiq — Muslim Companion (رفيق)

A private, offline-first, cross-platform desktop companion for practicing Muslims —
prayer times with adhan, Quran reading & recitation, prayer tracking, and
Hijri-aware daily guidance. Your data never leaves your machine.

Built with **Tauri 2** (Rust core) + **React 19 / TypeScript** (Vite) + Tailwind CSS.

## Download

Grab the latest installer for your platform from the
[Releases page](https://github.com/mansyar/rafiq/releases/latest):
Windows (MSI), macOS (DMG), and Linux (deb / AppImage / rpm).

The app checks for updates in the background at most once a day and offers a
one-click "restart to update". Update manifests are signed with minisign and
verified before install.

> **Unsigned builds — what to expect**
>
> These builds are not code-signed or notarized yet, so your OS may warn on
> first launch:
>
> - **Windows:** SmartScreen shows "Windows protected your PC". Choose
>   *More info* → *Run anyway*.
> - **macOS:** Gatekeeper blocks apps from unidentified developers. Right-click
>   the app → *Open* → *Open* (or allow it under System Settings → Privacy &
>   Security).
> - **Linux:** mark the AppImage executable (`chmod +x`) if your file manager
>   doesn't offer to run it.

## Getting Started

Prerequisites: [Node.js](https://nodejs.org) + [pnpm](https://pnpm.io) + [Rust](https://rustup.rs)

```bash
pnpm install
pnpm tauri dev
```

## Development

- `pnpm dev` — Vite dev server (frontend only)
- `pnpm build` — typecheck + production frontend build
- `pnpm tauri dev` — full desktop app in development mode
- `pnpm check` — Biome lint + format check (see Task 1.3)

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

Copyright © 2026 Rafiq contributors.

Licensed under either of the MIT license or the Apache License, Version 2.0,
at your option — both texts are in [LICENSE](LICENSE).