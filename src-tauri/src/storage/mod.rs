//! SQLite storage: schema migrations + key/value settings.

mod db;
mod settings;

pub use db::{init_db, schema_version, SCHEMA_VERSION};
pub use settings::SettingsRepo;

/// Opens an in-memory database with all migrations applied. Test-only helper
/// so feature modules can test against the real schema without a temp file.
#[cfg(test)]
pub(crate) fn test_memory_db() -> rusqlite::Connection {
    let mut conn = rusqlite::Connection::open_in_memory().unwrap();
    db::run_migrations(&mut conn).unwrap();
    conn
}
