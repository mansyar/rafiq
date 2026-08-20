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

use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Second instance focus request: bring the main window forward.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let conn = storage::init_db(&data_dir)?;
            app.manage(commands::AppState {
                conn: std::sync::Mutex::new(conn),
                data_dir,
            });
            // Spawn the adhan + notification scheduler (background thread).
            scheduler::spawn_scheduler(app.handle().clone());
            Ok(())
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
            commands::report_played_position
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
