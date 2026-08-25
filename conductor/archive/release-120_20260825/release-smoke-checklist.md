# Release-CSP Smoke Checklist — 1.2.0

Run against the **release build** (built with `--config src-tauri/tauri.release.json`),
not the dev build. The dev build intentionally keeps `csp: null`.

Build:

```powershell
pnpm tauri build --config src-tauri/tauri.release.json
# → src-tauri\target\release\rafiq.exe
```

Smoke pass (expected outcomes):

| # | Step | Expected |
|---|------|----------|
| 1 | Launch `rafiq.exe` (fresh or existing profile) | App boots, Today page renders, no CSP console errors (DevTools: webview console clean) |
| 2 | Today — prayer times | Times + next-prayer badge load from saved location |
| 3 | Quran — open any surah (e.g. Al-Fatiha) | Uthmani text + translations render (fonts load — `font-src 'self' data:`) |
| 4 | Quran — play an ayah recitation (network on) | Audio downloads + plays; after caching, **reload the app with network blocked** and replay — cached playback must work via asset protocol (`media-src 'self' asset: http://asset.localhost`) |
| 5 | Settings — switch language, method, toggles | All interact; labels localize (EN/ID) |
| 6 | Hijri calendar — month navigation | Renders, converter works |
| 7 | Error resilience — Today, daily reflection, Log stats, calendar, upcoming strip | Each screen surfaces a retryable error state with a Retry button instead of failing silently (spot-check one: launch with network blocked) |
| 8 | Updater — install failure path | Update banner stays visible with a "Try again" action instead of vanishing (behavior covered by component tests; spot-check banner appears on available update) |
| 9 | Double-submit guards — prayer prompt + log delete | "Prayed" cannot double-log; delete confirmation resets on Escape / click-away (Cancel path) |
| 10 | Settings toggles + translation switcher | Disable while pending and surface inline errors when a change fails |
| 11 | Adhan — autoplay blocked | Dismissible notice appears instead of silent failure |
| 12 | Recitation — media error | Playback pauses into a retryable state (spot-check: start playback, kill the network mid-stream) |
| 13 | Offline updater silence | With network blocked, no update errors or banners — app behaves normally (offline-first) |

Any blocked resource in the webview console = CSP gap → widen the specific
directive in `tauri.release.json`, rebuild, repeat.

> Resilience behaviors (rows 7–13) are primarily verified by the automated
> suite (249 frontend tests, incl. component tests for retry/error states);
> the rows above are manual spot-checks against the release build.

## Smoke pass results — 2026-08-25 (local Windows x64, release build)

Build: `pnpm tauri build --config src-tauri/tauri.release.json` → bundles
produced (MSI + NSIS at `Rafiq_1.2.0_x64-*`, `rafiq.exe` 23.7 MiB). Updater
signing step skipped locally: `TAURI_SIGNING_PRIVATE_KEY` is a GitHub secret
(CI) and is not set in the dev shell; signed updater artifacts are produced by
`release.yml` in Phase 3.

| # | Result | Notes |
|---|--------|-------|
| 1 | PASS | App boots, window "Rafiq - Muslim Companion", Today renders, console clean |
| 2 | PASS | Prayer times + next-prayer badge render |
| 3 | PASS | Al-Fatiha: Uthmani text + translations render (fonts OK) |
| 4 | PASS | Ayah recitation plays; UI reflects playback (cached-offline replay: Phase 4) |
| 5 | PASS | Language switch EN/ID, method + toggles interact |
| 6 | PASS | Calendar month navigation + converter work |
| 7–13 | deferred | Covered by automated suite (249 tests); full spot-check on the real machine in Phase 4 |

## Phase 4 results — real-machine verification (2026-08-25, Windows x64)

**In-app updater flow 1.1.0 → 1.2.0 (row 8 + updater flow):**

| Step | Result |
|------|--------|
| Start state | Rafiq 1.1.0 installed (`C:\Users\Ansyar\AppData\Local\Rafiq`) |
| Manual check (Settings → Updates → Check for updates) | Banner appeared |
| One-click download + install | Succeeded (app relaunched) |
| Post-update state | Registry `DisplayVersion` = **1.2.0**, fresh process |
| Install-failure "Try again" path | Covered by component tests (banner persists with retry instead of vanishing); no failure occurred on the real machine |

**Offline-first checks:**

| Check | Result |
|-------|--------|
| Cached recitation replays with network blocked (row 4/12) | PASS — plays from asset-protocol cache |
| Offline updater silence (row 13) | PASS — no update errors/banners while offline |
| Resilience spot-checks (rows 7, 9, 10) | PASS — retryable error states, double-submit guards, pending-disable toggles |