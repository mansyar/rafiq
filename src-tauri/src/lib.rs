// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod city;
pub mod commands;
pub mod daily;
pub mod hijri;
pub mod log;
pub mod prayer;
pub mod quran;
pub mod recitation;
pub mod scheduler;
pub mod storage;
pub mod tray;

use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Second instance: restore + focus even if hidden in the tray
            // (FR-6 / AC-4).
            tray::runtime::show_main(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let base_dir = app.path().app_data_dir()?;
            let data_dir = storage::resolve_data_dir(&base_dir);
            let conn = storage::init_db(&data_dir)?;
            app.manage(commands::AppState {
                conn: std::sync::Mutex::new(conn),
                data_dir,
            });
            // Spawn the adhan + notification scheduler (background thread).
            scheduler::spawn_scheduler(app.handle().clone());
            // System tray icon + menu (close-to-tray background presence).
            tray::runtime::init(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Close-to-tray: intercepting the X button keeps adhan reminders
            // alive; minimize is untouched (FR-2 / FR-8 / AC-1 / AC-8).
            // Scoped to the main window so any future auxiliary window
            // closes normally.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    tray::runtime::on_close_requested(window.app_handle());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_setting,
            commands::set_setting,
            commands::db_status,
            commands::get_prayer_times,
            commands::get_location,
            commands::set_location,
            commands::search_cities,
            commands::get_city_by_id,
            commands::get_resolved_location,
            commands::get_next_prayer,
            commands::reschedule_prayer_notifications,
            commands::trigger_test_prayer,
            commands::list_surahs,
            commands::get_surah,
            commands::search_surahs,
            commands::get_quran_translation,
            commands::set_quran_translation,
            commands::get_daily_content,
            commands::log_prayer,
            commands::delete_log_entry,
            commands::get_prayer_log,
            commands::get_log_analytics,
            commands::hijri_from_gregorian,
            commands::hijri_to_gregorian,
            commands::hijri_month_grid,
            commands::today_hijri,
            commands::fetch_ayah_audio,
            commands::get_recitation_state,
            commands::report_played_position,
            commands::get_recitation_cache_summary,
            commands::delete_recitation_cache,
            commands::set_tray_labels
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
