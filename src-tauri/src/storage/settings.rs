//! Key/value settings repository backed by the `settings` table.

use rusqlite::{Connection, OptionalExtension};

/// Typed access to the `settings` table.
pub struct SettingsRepo<'a> {
    conn: &'a Connection,
}

impl<'a> SettingsRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// Returns the value for `key`, or `None` when unset.
    pub fn get(&self, key: &str) -> rusqlite::Result<Option<String>> {
        self.conn
            .query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
                row.get::<_, String>(0)
            })
            .optional()
    }

    /// Sets `key` to `value`, overwriting any existing value (upsert).
    pub fn set(&self, key: &str, value: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [key, value],
        )?;
        Ok(())
    }
}
