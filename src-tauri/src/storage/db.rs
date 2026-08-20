//! Database initialization and schema versioning.

use rusqlite::{Connection, OptionalExtension};
use std::error::Error;
use std::path::Path;

/// Latest schema version understood by this build.
pub const SCHEMA_VERSION: i64 = 2;

pub(crate) type Result<T> = std::result::Result<T, Box<dyn Error>>;

/// Migration 1: initial schema — `meta` (schema version row) + `settings`.
const MIGRATION_001: &str = r#"
CREATE TABLE meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    schema_version INTEGER NOT NULL
);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"#;

/// Migration 2: `prayer_log` — one row per (local date, prayer) for the five
/// obligatory prayers; the on-time/qada classification is captured once, at
/// log time, and never re-graded.
const MIGRATION_002: &str = r#"
CREATE TABLE prayer_log (
    id INTEGER PRIMARY KEY,
    log_date TEXT NOT NULL,
    prayer TEXT NOT NULL,
    logged_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('on_time', 'qada')),
    UNIQUE (log_date, prayer)
);
"#;

const MIGRATIONS: &[&str] = &[MIGRATION_001, MIGRATION_002];

/// Opens (or creates) the SQLite database at `app_data_dir/rafiq.db` and
/// applies any pending migrations. Idempotent on an existing database.
pub fn init_db(app_data_dir: &Path) -> Result<Connection> {
    std::fs::create_dir_all(app_data_dir)?;
    let mut conn = Connection::open(app_data_dir.join("rafiq.db"))?;
    run_migrations(&mut conn)?;
    Ok(conn)
}

/// Applies all pending migrations in order, tracking the current version in
/// `meta.schema_version`. Safe to call repeatedly.
fn run_migrations(conn: &mut Connection) -> Result<()> {
    let current = schema_version(conn)?;
    for (index, migration) in MIGRATIONS.iter().enumerate() {
        let version = (index + 1) as i64;
        if version > current {
            let tx = conn.transaction()?;
            tx.execute_batch(migration)?;
            tx.execute(
                "INSERT INTO meta (id, schema_version) VALUES (1, ?1)
                 ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version",
                [version],
            )?;
            tx.commit()?;
        }
    }
    Ok(())
}

/// Reads the current schema version. Returns 0 when the meta table is absent.
pub fn schema_version(conn: &Connection) -> Result<i64> {
    let meta_exists = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .optional()?
        .is_some();

    if !meta_exists {
        return Ok(0);
    }

    Ok(
        conn.query_row("SELECT schema_version FROM meta WHERE id = 1", [], |row| {
            row.get::<_, i64>(0)
        })?,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Opens an in-memory database and applies all pending migrations.
    fn migrated_conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        run_migrations(&mut conn).unwrap();
        conn
    }

    #[test]
    fn migrations_bring_a_fresh_database_to_the_latest_schema() {
        let mut conn = Connection::open_in_memory().unwrap();

        run_migrations(&mut conn).unwrap();

        assert_eq!(SCHEMA_VERSION, 2);
        assert_eq!(schema_version(&conn).unwrap(), SCHEMA_VERSION);
    }

    #[test]
    fn migration_2_creates_prayer_log_with_unique_date_prayer() {
        let conn = migrated_conn();

        let exists: i64 = conn
            .query_row(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'prayer_log'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(exists, 1);

        conn.execute(
            "INSERT INTO prayer_log (log_date, prayer, logged_at, status)
             VALUES ('2026-08-20', 'fajr', '2026-08-20T04:30:00Z', 'on_time')",
            [],
        )
        .unwrap();

        let duplicate = conn.execute(
            "INSERT INTO prayer_log (log_date, prayer, logged_at, status)
             VALUES ('2026-08-20', 'fajr', '2026-08-20T04:31:00Z', 'on_time')",
            [],
        );
        assert!(
            duplicate.is_err(),
            "duplicate (log_date, prayer) must be rejected"
        );

        conn.execute(
            "INSERT INTO prayer_log (log_date, prayer, logged_at, status)
             VALUES ('2026-08-20', 'dhuhr', '2026-08-20T11:30:00Z', 'on_time')",
            [],
        )
        .unwrap();
    }

    #[test]
    fn migrations_are_idempotent_on_an_existing_database() {
        let mut conn = migrated_conn();

        run_migrations(&mut conn).unwrap();

        assert_eq!(schema_version(&conn).unwrap(), SCHEMA_VERSION);
    }
}
