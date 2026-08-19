//! Integration tests for the storage module (public API contract).
//! Scope per project rule: logic-bearing code — storage requires tests.

use rafiq_lib::storage::{init_db, SettingsRepo, SCHEMA_VERSION};
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

#[test]
fn migrations_apply_to_fresh_db() {
    let dir = test_dir("migrations");
    let conn = init_db(&dir).expect("init db");

    // meta table created with single-row schema_version
    let meta_tables: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('meta', 'settings')",
            [],
            |row| row.get::<_, i64>(0),
        )
        .expect("query table list");
    assert_eq!(meta_tables, 2, "meta and settings tables must exist");

    // settings table empty on fresh DB
    let settings_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM settings", [], |row| {
            row.get::<_, i64>(0)
        })
        .expect("count settings");
    assert_eq!(settings_count, 0);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn schema_version_is_correct_after_init() {
    let dir = test_dir("version");
    let conn = init_db(&dir).expect("init db");

    let version: i64 = conn
        .query_row("SELECT schema_version FROM meta WHERE id = 1", [], |row| {
            row.get::<_, i64>(0)
        })
        .expect("read schema_version");
    assert_eq!(version, SCHEMA_VERSION);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn init_db_is_idempotent() {
    let dir = test_dir("idempotent");
    let _ = init_db(&dir).expect("first init");
    // Re-initializing an existing DB must not fail or duplicate migrations.
    let _ = init_db(&dir).expect("second init");

    let conn = init_db(&dir).expect("third init for check");
    let version: i64 = conn
        .query_row("SELECT schema_version FROM meta WHERE id = 1", [], |row| {
            row.get::<_, i64>(0)
        })
        .expect("read schema_version");
    assert_eq!(version, SCHEMA_VERSION, "re-init must keep version stable");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn settings_set_get_roundtrip() {
    let dir = test_dir("roundtrip");
    let conn = init_db(&dir).expect("init db");
    let repo = SettingsRepo::new(&conn);

    repo.set("locale", "en").expect("set locale");
    assert_eq!(
        repo.get("locale").expect("get locale"),
        Some("en".to_string())
    );

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn unknown_key_returns_none() {
    let dir = test_dir("unknown");
    let conn = init_db(&dir).expect("init db");
    let repo = SettingsRepo::new(&conn);

    assert_eq!(repo.get("missing").expect("get missing"), None);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn upsert_overwrites_existing_value() {
    let dir = test_dir("upsert");
    let conn = init_db(&dir).expect("init db");
    let repo = SettingsRepo::new(&conn);

    repo.set("locale", "en").expect("set first");
    repo.set("locale", "id").expect("set second");

    assert_eq!(
        repo.get("locale").expect("get after upsert"),
        Some("id".to_string())
    );
    let row_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM settings WHERE key = 'locale'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .expect("count rows for key");
    assert_eq!(row_count, 1, "upsert must not create duplicate rows");

    let _ = std::fs::remove_dir_all(&dir);
}
