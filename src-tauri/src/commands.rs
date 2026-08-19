//! Typed Tauri command handlers and their testable logic.

use crate::prayer::{calculate_prayer_times, CalculationMethod, Coordinates, PrayerTimes};
use crate::storage::{schema_version, SettingsRepo};
use chrono::NaiveDate;
use rusqlite::Connection;
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

/// Shared application state managed by Tauri.
pub struct AppState {
    pub conn: Mutex<Connection>,
    pub data_dir: std::path::PathBuf,
}

/// Health-check payload returned by `db_status`.
#[derive(Debug, Serialize)]
pub struct DbStatus {
    pub path: String,
    pub version: i64,
}

const MAX_KEY_LEN: usize = 256;

/// Settings key used for the persisted prayer calculation method.
pub const PRAYER_METHOD_SETTING_KEY: &str = "prayer_calculation_method";

/// Returns the stored value for `key`, or `None` when unset.
pub fn get_setting_impl(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let key = validate_key(key)?;
    SettingsRepo::new(conn).get(&key).map_err(|e| e.to_string())
}

/// Stores `key` = `value`, overwriting any previous value.
pub fn set_setting_impl(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    let key = validate_key(key)?;
    SettingsRepo::new(conn)
        .set(&key, value)
        .map_err(|e| e.to_string())
}

/// Reports the database file path and current schema version.
pub fn db_status_impl(conn: &Connection, data_dir: &Path) -> Result<DbStatus, String> {
    let version = schema_version(conn).map_err(|e| e.to_string())?;
    Ok(DbStatus {
        path: data_dir.join("rafiq.db").to_string_lossy().into_owned(),
        version,
    })
}

/// Parses a date, resolves the configured calculation method, and calculates
/// prayer times without requiring a Tauri runtime.
pub fn get_prayer_times_impl(
    conn: &Connection,
    date: &str,
    coordinates: Coordinates,
    method: Option<CalculationMethod>,
) -> Result<PrayerTimes, String> {
    let date = NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|error| format!("invalid date '{date}', expected YYYY-MM-DD: {error}"))?;
    let method = match method {
        Some(method) => method,
        None => resolve_prayer_method(conn)?,
    };

    calculate_prayer_times(date, coordinates, method)
}

fn resolve_prayer_method(conn: &Connection) -> Result<CalculationMethod, String> {
    let value = SettingsRepo::new(conn)
        .get(PRAYER_METHOD_SETTING_KEY)
        .map_err(|error| format!("could not read prayer calculation method: {error}"))?;

    value.map_or(Ok(CalculationMethod::default()), |value| {
        serde_json::from_value(serde_json::Value::String(value.trim().to_string()))
            .map_err(|_| format!("invalid prayer calculation method setting: {value}"))
    })
}

/// Trims and validates a settings key.
fn validate_key(key: &str) -> Result<String, String> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err("key must not be empty".to_string());
    }
    if trimmed.chars().count() > MAX_KEY_LEN {
        return Err(format!("key must be {MAX_KEY_LEN} characters or fewer"));
    }
    Ok(trimmed.to_string())
}

#[tauri::command]
pub fn get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "app state lock poisoned".to_string())?;
    get_setting_impl(&conn, &key)
}

#[tauri::command]
pub fn set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "app state lock poisoned".to_string())?;
    set_setting_impl(&conn, &key, &value)
}

#[tauri::command]
pub fn db_status(state: State<'_, AppState>) -> Result<DbStatus, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "app state lock poisoned".to_string())?;
    db_status_impl(&conn, &state.data_dir)
}

#[tauri::command]
pub fn get_prayer_times(
    state: State<'_, AppState>,
    date: String,
    coordinates: Coordinates,
    method: Option<CalculationMethod>,
) -> Result<PrayerTimes, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "app state lock poisoned".to_string())?;
    get_prayer_times_impl(&conn, &date, coordinates, method)
}

#[cfg(test)]
mod tests {
    use crate::prayer::{calculate_prayer_times, CalculationMethod, Coordinates};
    use crate::storage::{init_db, SettingsRepo, SCHEMA_VERSION};
    use rusqlite::Connection;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    /// Unique temp directory per test run (no extra dev-dependencies).
    fn test_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock before epoch")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "rafiq_test_{}_{}_{name}",
            std::process::id(),
            unique
        ))
    }

    fn conn(name: &str) -> Connection {
        init_db(&test_dir(name)).expect("init db")
    }

    #[test]
    fn get_setting_returns_none_for_unknown_key() {
        let conn = conn("cmd-get-none");
        assert_eq!(super::get_setting_impl(&conn, "missing").unwrap(), None);
    }

    #[test]
    fn set_then_get_setting_roundtrip() {
        let conn = conn("cmd-roundtrip");
        super::set_setting_impl(&conn, "locale", "id").unwrap();
        assert_eq!(
            super::get_setting_impl(&conn, "locale").unwrap(),
            Some("id".to_string())
        );
    }

    #[test]
    fn get_setting_rejects_empty_key() {
        let conn = conn("cmd-get-empty");
        let err = super::get_setting_impl(&conn, "  ").unwrap_err();
        assert!(err.contains("empty"), "unexpected error: {err}");
    }

    #[test]
    fn set_setting_rejects_empty_key() {
        let conn = conn("cmd-set-empty");
        let err = super::set_setting_impl(&conn, "", "x").unwrap_err();
        assert!(err.contains("empty"), "unexpected error: {err}");
    }

    #[test]
    fn set_setting_rejects_overlong_key() {
        let conn = conn("cmd-set-long");
        let long_key = "k".repeat(257);
        let err = super::set_setting_impl(&conn, &long_key, "x").unwrap_err();
        assert!(err.contains("256"), "unexpected error: {err}");
    }

    #[test]
    fn db_status_reports_path_and_version() {
        let dir = test_dir("cmd-status");
        let conn = init_db(&dir).unwrap();
        let status = super::db_status_impl(&conn, &dir).unwrap();

        assert_eq!(status.version, SCHEMA_VERSION);
        assert!(
            status.path.ends_with("rafiq.db"),
            "unexpected path: {}",
            status.path
        );

        // shape check: serializes to { path, version }
        let json = serde_json::to_value(&status).unwrap();
        assert!(json.get("path").is_some(), "missing path key");
        assert!(json.get("version").is_some(), "missing version key");
    }

    fn prayer_coordinates() -> Coordinates {
        Coordinates {
            latitude: 35.7750,
            longitude: -78.6336,
        }
    }

    #[test]
    fn get_prayer_times_uses_mwl_when_method_setting_is_unset() {
        let conn = conn("cmd-prayer-default");
        let actual =
            super::get_prayer_times_impl(&conn, "2015-07-12", prayer_coordinates(), None).unwrap();
        let expected = calculate_prayer_times(
            chrono::NaiveDate::from_ymd_opt(2015, 7, 12).unwrap(),
            prayer_coordinates(),
            CalculationMethod::MuslimWorldLeague,
        )
        .unwrap();

        assert_eq!(actual, expected);
    }

    #[test]
    fn get_prayer_times_uses_persisted_method_when_override_is_absent() {
        let conn = conn("cmd-prayer-setting");
        SettingsRepo::new(&conn)
            .set(super::PRAYER_METHOD_SETTING_KEY, "tehran")
            .unwrap();

        let actual =
            super::get_prayer_times_impl(&conn, "2015-07-12", prayer_coordinates(), None).unwrap();
        let expected = calculate_prayer_times(
            chrono::NaiveDate::from_ymd_opt(2015, 7, 12).unwrap(),
            prayer_coordinates(),
            CalculationMethod::Tehran,
        )
        .unwrap();

        assert_eq!(actual, expected);
    }

    #[test]
    fn get_prayer_times_method_override_takes_precedence_over_setting() {
        let conn = conn("cmd-prayer-override");
        SettingsRepo::new(&conn)
            .set(super::PRAYER_METHOD_SETTING_KEY, "tehran")
            .unwrap();

        let actual = super::get_prayer_times_impl(
            &conn,
            "2015-07-12",
            prayer_coordinates(),
            Some(CalculationMethod::Karachi),
        )
        .unwrap();
        let expected = calculate_prayer_times(
            chrono::NaiveDate::from_ymd_opt(2015, 7, 12).unwrap(),
            prayer_coordinates(),
            CalculationMethod::Karachi,
        )
        .unwrap();

        assert_eq!(actual, expected);
    }

    #[test]
    fn get_prayer_times_rejects_invalid_coordinates() {
        let conn = conn("cmd-prayer-invalid-coordinates");
        let error = super::get_prayer_times_impl(
            &conn,
            "2015-07-12",
            Coordinates {
                latitude: 91.0,
                longitude: 0.0,
            },
            None,
        )
        .unwrap_err();

        assert!(error.contains("latitude"), "unexpected error: {error}");
    }

    #[test]
    fn get_prayer_times_rejects_invalid_date() {
        let conn = conn("cmd-prayer-invalid-date");
        let error = super::get_prayer_times_impl(&conn, "12/07/2015", prayer_coordinates(), None)
            .unwrap_err();

        assert!(error.contains("YYYY-MM-DD"), "unexpected error: {error}");
    }

    #[test]
    fn get_prayer_times_rejects_invalid_persisted_method() {
        let conn = conn("cmd-prayer-invalid-method");
        SettingsRepo::new(&conn)
            .set(super::PRAYER_METHOD_SETTING_KEY, "not-a-method")
            .unwrap();

        let error = super::get_prayer_times_impl(&conn, "2015-07-12", prayer_coordinates(), None)
            .unwrap_err();

        assert!(
            error.contains("calculation method"),
            "unexpected error: {error}"
        );
    }
}
