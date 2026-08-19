//! Database initialization and schema versioning.

use rusqlite::{Connection, OptionalExtension};
use std::error::Error;
use std::path::Path;

/// Latest schema version understood by this build.
pub const SCHEMA_VERSION: i64 = 1;

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

const MIGRATIONS: &[&str] = &[MIGRATION_001];

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
