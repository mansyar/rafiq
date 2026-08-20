//! Typed Tauri command handlers and their testable logic.

use crate::city::{find_city_by_id, validate_coordinates, City};
use crate::prayer::{calculate_prayer_times, CalculationMethod, Coordinates, PrayerTimes};
use crate::storage::{schema_version, SettingsRepo};
use chrono::NaiveDate;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
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

/// Settings key used for the persisted prayer location (city or manual).
pub const LOCATION_SETTING_KEY: &str = "prayer_location";

/// Persisted location — either a bundled city or manual coordinates.
/// Serialized as JSON under `LOCATION_SETTING_KEY`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Location {
    /// Bundled city id (e.g., "jakarta-id-1"); when `Some`, manual coordinates are ignored.
    pub city_id: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

impl Location {
    /// City-backed location.
    pub fn from_city(city_id: impl Into<String>) -> Self {
        Self {
            city_id: Some(city_id.into()),
            latitude: None,
            longitude: None,
        }
    }

    /// Manual coordinate location.
    pub fn from_manual(latitude: f64, longitude: f64) -> Self {
        Self {
            city_id: None,
            latitude: Some(latitude),
            longitude: Some(longitude),
        }
    }
}

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

/// Returns the persisted location, or `None` when unset.
pub fn get_location_impl(conn: &Connection) -> Result<Option<Location>, String> {
    let raw = SettingsRepo::new(conn)
        .get(LOCATION_SETTING_KEY)
        .map_err(|e| e.to_string())?;
    match raw {
        None => Ok(None),
        Some(json) => serde_json::from_str::<Location>(&json)
            .map(Some)
            .map_err(|e| format!("invalid location setting: {e}")),
    }
}

/// Validates and persists a location. Rejects invalid city ids and out-of-range coordinates
/// with friendly errors.
pub fn set_location_impl(conn: &Connection, location: Location) -> Result<(), String> {
    validate_location(&location)?;
    let json = serde_json::to_string(&location).map_err(|e| e.to_string())?;
    SettingsRepo::new(conn)
        .set(LOCATION_SETTING_KEY, &json)
        .map_err(|e| e.to_string())
}

/// Validates a `Location` without persisting it.
fn validate_location(location: &Location) -> Result<(), String> {
    let has_city = location
        .city_id
        .as_ref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let has_manual = location.latitude.is_some() || location.longitude.is_some();

    if has_city {
        let cid = location.city_id.as_ref().unwrap().trim();
        if find_city_by_id(cid).is_none() {
            return Err(format!("city not found: {cid}"));
        }
        // city takes precedence — manual coordinates are ignored when city is set
        return Ok(());
    }

    if has_manual {
        let lat = location.latitude.ok_or_else(|| {
            "both latitude and longitude are required for manual location".to_string()
        })?;
        let lon = location.longitude.ok_or_else(|| {
            "both latitude and longitude are required for manual location".to_string()
        })?;
        validate_coordinates(lat, lon)?;
        return Ok(());
    }

    Err("no location provided: set city_id or manual coordinates".to_string())
}

/// Searches the bundled city dataset (case-insensitive, ranked).
pub fn search_cities_impl(query: &str, limit: Option<usize>) -> Vec<City> {
    let capped = limit.unwrap_or(10).clamp(1, 20);
    crate::city::search_cities(query, capped)
}

/// Resolves a persisted `Location` to concrete coordinates + timezone.
/// Used by callers that need validated lat/lon (e.g., prayer calculation).
pub fn resolve_stored_location(
    conn: &Connection,
) -> Result<Option<crate::city::ResolvedLocation>, String> {
    let loc = get_location_impl(conn)?;
    match loc {
        None => Ok(None),
        Some(location) => {
            let resolved = crate::city::resolve_location(
                location.city_id.as_deref(),
                location.latitude,
                location.longitude,
            )
            .map_err(|e| format!("invalid stored location: {e}"))?;
            Ok(Some(resolved))
        }
    }
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

#[tauri::command]
pub fn get_location(state: State<'_, AppState>) -> Result<Option<Location>, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "app state lock poisoned".to_string())?;
    get_location_impl(&conn)
}

#[tauri::command]
pub fn set_location(state: State<'_, AppState>, location: Location) -> Result<(), String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "app state lock poisoned".to_string())?;
    set_location_impl(&conn, location)
}

#[tauri::command]
pub fn search_cities(query: String, limit: Option<usize>) -> Result<Vec<City>, String> {
    // pure function — no state needed, but keep Result for frontend consistency
    Ok(search_cities_impl(&query, limit))
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

    #[test]
    fn get_location_returns_none_initially() {
        let conn = conn("cmd-loc-none");
        assert_eq!(super::get_location_impl(&conn).unwrap(), None);
    }

    #[test]
    fn set_then_get_location_city_roundtrip() {
        let conn = conn("cmd-loc-city");
        let jakarta_id = crate::city::all_cities()
            .iter()
            .find(|c| c.name == "Jakarta" && c.country == "Indonesia")
            .unwrap()
            .id
            .clone();
        let loc = super::Location::from_city(jakarta_id.clone());
        super::set_location_impl(&conn, loc.clone()).unwrap();
        let fetched = super::get_location_impl(&conn).unwrap().unwrap();
        assert_eq!(fetched.city_id, Some(jakarta_id));
        assert_eq!(fetched.latitude, None);
    }

    #[test]
    fn set_then_get_location_manual_roundtrip() {
        let conn = conn("cmd-loc-manual");
        let loc = super::Location::from_manual(-6.2088, 106.8456);
        super::set_location_impl(&conn, loc.clone()).unwrap();
        let fetched = super::get_location_impl(&conn).unwrap().unwrap();
        assert_eq!(fetched.latitude, Some(-6.2088));
        assert_eq!(fetched.longitude, Some(106.8456));
        assert_eq!(fetched.city_id, None);
    }

    #[test]
    fn set_location_rejects_invalid_city() {
        let conn = conn("cmd-loc-bad-city");
        let loc = super::Location::from_city("does-not-exist-123");
        let err = super::set_location_impl(&conn, loc).unwrap_err();
        assert!(
            err.to_lowercase().contains("not found"),
            "unexpected: {err}"
        );
    }

    #[test]
    fn set_location_rejects_invalid_manual_coordinates() {
        let conn = conn("cmd-loc-bad-coord");
        let loc = super::Location::from_manual(91.0, 0.0);
        let err = super::set_location_impl(&conn, loc).unwrap_err();
        assert!(err.contains("latitude"), "unexpected: {err}");
        let loc2 = super::Location {
            city_id: None,
            latitude: Some(0.0),
            longitude: None,
        };
        let err2 = super::set_location_impl(&conn, loc2).unwrap_err();
        assert!(err2.contains("both"), "unexpected: {err2}");
    }

    #[test]
    fn set_location_rejects_empty_location() {
        let conn = conn("cmd-loc-empty");
        let loc = super::Location {
            city_id: None,
            latitude: None,
            longitude: None,
        };
        let err = super::set_location_impl(&conn, loc).unwrap_err();
        assert!(err.contains("no location"), "unexpected: {err}");
    }

    #[test]
    fn search_cities_returns_ranked_results() {
        let results = super::search_cities_impl("Jakarta", Some(5));
        assert!(!results.is_empty());
        assert!(results.iter().any(|c| c.name == "Jakarta"));
    }

    #[test]
    fn search_cities_limit_capped() {
        let results = super::search_cities_impl("a", Some(5));
        assert_eq!(results.len(), 5);
        let empty = super::search_cities_impl("", Some(5));
        assert!(empty.is_empty());
        let not_found = super::search_cities_impl("xyznotfound123", Some(5));
        assert!(not_found.is_empty());
    }

    #[test]
    fn resolve_stored_location_after_set() {
        let conn = conn("cmd-loc-resolve");
        let jakarta = crate::city::all_cities()
            .iter()
            .find(|c| c.name == "Jakarta" && c.country == "Indonesia")
            .unwrap()
            .clone();
        super::set_location_impl(&conn, super::Location::from_city(jakarta.id.clone())).unwrap();
        let resolved = super::resolve_stored_location(&conn).unwrap().unwrap();
        assert_eq!(resolved.latitude, jakarta.latitude);
        assert_eq!(resolved.longitude, jakarta.longitude);
        assert_eq!(resolved.city.unwrap().id, jakarta.id);
    }

    #[test]
    fn location_serializes_as_expected_shape() {
        let loc = super::Location::from_manual(-6.2, 106.8);
        let json = serde_json::to_value(&loc).unwrap();
        assert!(json.get("city_id").is_some());
        assert!(json.get("latitude").is_some());
        assert!(json.get("longitude").is_some());
    }
}
