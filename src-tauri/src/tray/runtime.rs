//! OS tray runtime wiring (FR-1..FR-8). Pure formatting/policy logic lives in
//! the parent module; this file maps it onto Tauri's tray APIs. OS-level
//! behavior is verified by the manual smoke checklist (NFR-4).

use std::sync::{Mutex, OnceLock};

use chrono::{Local, Utc};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State, Wry};
use tauri_plugin_notification::NotificationExt;

use super::{should_show_tray_hint, TrayLabels, TRAY_HINT_SHOWN_KEY};
use crate::commands::{get_setting_impl, set_setting_impl, AppState};
use crate::scheduler::compute_next_prayer;

/// Handles kept for live updates (info-row text, tooltip, label swaps).
pub struct TrayHandles {
    pub info: MenuItem<Wry>,
    pub show_item: MenuItem<Wry>,
    pub quit_item: MenuItem<Wry>,
    pub tray: TrayIcon<Wry>,
}

static LABELS: OnceLock<Mutex<TrayLabels>> = OnceLock::new();

fn labels() -> &'static Mutex<TrayLabels> {
    LABELS.get_or_init(|| Mutex::new(default_labels()))
}

/// English defaults; replaced by localized labels once the frontend sends
/// them via `set_tray_labels` (NFR-1).
fn default_labels() -> TrayLabels {
    TrayLabels {
        next_prefix: "Next:".into(),
        complete_setup: "Complete setup in Rafiq".into(),
        show: "Show Rafiq".into(),
        quit: "Quit Rafiq".into(),
        hint_body: "Rafiq is still running in the system tray — adhan reminders \
                    continue. You can quit anytime from the tray menu."
            .into(),
    }
}

/// Build the tray icon + menu and register event handlers. Called once from
/// `setup` in lib.rs.
pub fn init(app: &AppHandle) -> tauri::Result<()> {
    let l = labels().lock().unwrap();
    let info = MenuItem::with_id(app, "next-prayer", &l.complete_setup, false, None::<&str>)?;
    let show_item = MenuItem::with_id(app, "show", &l.show, true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", &l.quit, true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&info, &show_item, &quit_item])?;
    drop(l);

    let tray = TrayIconBuilder::with_id("rafiq-tray")
        .icon(tauri::include_image!("icons/tray.png"))
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Rafiq")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main(app),
            // Clean exit: detached scheduler thread dies with the process
            // (FR-3 / AC-5).
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Left-click shows/focuses the window; right-click opens the
            // menu (FR-4).
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;

    app.manage(TrayHandles {
        info,
        show_item,
        quit_item,
        tray,
    });
    Ok(())
}

/// Show, unminimize and focus the main window (also used by the
/// single-instance handler, FR-6).
pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Called from the window close interceptor: hides instead of exiting and
/// shows the one-time explainer notification (FR-2 / AC-1 / AC-2).
pub fn on_close_requested(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    maybe_show_tray_hint(app);
}

fn maybe_show_tray_hint(app: &AppHandle) {
    let state: State<AppState> = app.state();
    let stored = {
        let conn = state.conn.lock().unwrap();
        get_setting_impl(&conn, TRAY_HINT_SHOWN_KEY).ok().flatten()
    };
    if !should_show_tray_hint(stored.as_deref()) {
        return;
    }
    let body = labels().lock().unwrap().hint_body.clone();
    let _ = app
        .notification()
        .builder()
        .title("Rafiq")
        .body(body)
        .show();
    let conn = state.conn.lock().unwrap();
    let _ = set_setting_impl(&conn, TRAY_HINT_SHOWN_KEY, "1");
}

/// Recompute the next prayer and refresh the disabled info row + tooltip.
/// Runs on init and on the ~30 s refresh tick (FR-3 / FR-5 / NFR-3).
pub fn refresh_once(app: &AppHandle) {
    let handles = match app.try_state::<TrayHandles>() {
        Some(h) => h,
        None => return,
    };
    let next = {
        let state: State<AppState> = app.state();
        let conn = state.conn.lock().unwrap();
        compute_next_prayer(&conn, Utc::now()).ok().flatten()
    };
    let offset = *Local::now().offset();
    let l = labels().lock().unwrap();
    let (info_text, tooltip) = match &next {
        Some((prayer, instant)) => {
            let row = super::countdown_row(&l.next_prefix, prayer, *instant, offset);
            // Tooltip uses a plain space before the time (spec FR-5):
            // "Rafiq — Next: Asr 16:12".
            let short = format!(
                "{} {} {}",
                l.next_prefix.trim_end(),
                super::capitalize(prayer),
                instant.with_timezone(&offset).format("%H:%M")
            );
            (row, format!("Rafiq — {short}"))
        }
        None => (l.complete_setup.clone(), "Rafiq".to_string()),
    };
    drop(l);
    let _ = handles.info.set_text(info_text);
    let _ = handles.tray.set_tooltip(Some(tooltip));
}

/// Swap in localized labels from the frontend catalog and refresh visible
/// texts immediately (NFR-1 / AC-6).
pub fn apply_labels(app: &AppHandle, new_labels: TrayLabels) {
    *labels().lock().unwrap() = new_labels;
    refresh_once(app);
    let handles = match app.try_state::<TrayHandles>() {
        Some(h) => h,
        None => return,
    };
    let l = labels().lock().unwrap();
    let _ = handles.show_item.set_text(l.show.clone());
    let _ = handles.quit_item.set_text(l.quit.clone());
}
