# Release-CSP Smoke Checklist

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

Any blocked resource in the webview console = CSP gap → widen the specific
directive in `tauri.release.json`, rebuild, repeat.
