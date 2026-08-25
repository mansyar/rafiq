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