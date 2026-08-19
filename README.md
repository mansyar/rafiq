# Rafiq — Muslim Companion (رفيق)

A private, offline-first, cross-platform desktop companion for practicing Muslims —
prayer times with adhan, Quran reading & recitation, prayer tracking, and
Hijri-aware daily guidance. Your data never leaves your machine.

Built with **Tauri 2** (Rust core) + **React 19 / TypeScript** (Vite) + Tailwind CSS.

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