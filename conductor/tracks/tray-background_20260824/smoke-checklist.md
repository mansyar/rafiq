# Smoke Checklist — System Tray & Background Presence

**Track:** `tray-background_20260824` · Walks AC-1..AC-8 from [spec.md](./spec.md) on each desktop OS.
Run once per OS before release. Windows verified during the track; macOS/Linux before their next builds.

## Setup (all OSes)

1. `pnpm install && pnpm tauri dev` (or install a built bundle).
2. Complete onboarding with a valid city so prayer times exist.
3. Note the next prayer time shown on the Today page.

## Checks

| # | AC | Step | Expected |
|---|----|------|----------|
| 1 | AC-1 | Click the window **X** while adhan is enabled; wait for the next prayer time (or use Settings → test trigger with the window hidden) | Window hides to tray; notification/adhan still fire; in-app prompt appears after restore |
| 2 | AC-2 | Close to tray → explainer notification appears **once**; restore, close again | Hint never repeats; persists across app restarts (`tray_hint_shown` setting) |
| 3 | AC-3 | Hover the tray icon before and after the next prayer passes (wait or change system clock) | Tooltip/menu row shows `Next: <Prayer> · HH:MM` local time and rolls over to the next prayer within ~30 s |
| 4 | AC-4 | With the window hidden, restore via (a) left-click on the icon, (b) tray menu → Show Rafiq, (c) launching a second instance | All three restore + focus the same window; no second process remains |
| 5 | AC-5 | Tray menu → Quit Rafiq; check process list (`Get-Process rafiq` / Activity Monitor / `ps`) | App exits immediately; tray icon disappears; no orphan process |
| 6 | AC-6 | On a fresh profile (delete app data), open the tray menu **before** completing onboarding, then complete it | Placeholder “Complete setup in Rafiq” shown first; replaced by the countdown within ~30 s after location is set |
| 7 | AC-7 | Settings → Launch at login → On; restart app | Toggle persisted; OS autostart entry exists (Win: Startup apps; macOS: Login Items; Linux: autostart dir). Toggle Off removes it |
| 8 | AC-8 | Click the **–** minimize button | Normal taskbar/dock minimize; window never hides to tray via minimize |
| 9 | NFR-1 | Switch language EN ↔ ID in Settings | Tray menu, tooltip prefix, and hint copy switch immediately (Show/Quit/countdown prefix) |
| 10 | FR-1 | Compare tray icon on light and dark taskbar/menu bar | Monochrome crescent stays visible on both (Windows light/dark, macOS template, Linux appindicator) |

## Platform notes

- **Windows 10/11:** shell notification area; test both overflow (“^”) and pinned icon states.
- **macOS:** menu bar extra uses template image (`icon_as_template(true)`); verify in light + dark menu bar.
- **Linux (AppImage/deb/rpm):** requires an appindicator-compatible shell (GNOME: AppIndicator extension); verify menu opens on left- and right-click per desktop convention.
