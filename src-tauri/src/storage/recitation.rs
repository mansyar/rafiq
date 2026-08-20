//! Recitation audio index: which per-ayah MP3s are cached locally.

use rusqlite::{params, Connection, OptionalExtension};

/// A cached per-ayah recitation file.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct CachedAudio {
    /// Global ayah number (1..=6236) this file plays.
    pub global_ayah: u32,
    /// Path of the cached MP3 (inside the app-data `recitation/` directory).
    pub file_path: String,
    /// File size in bytes, as recorded at download time.
    pub size_bytes: u64,
    /// RFC3339 UTC timestamp of the download.
    pub fetched_at: String,
}

/// Typed access to the `recitation` audio-index table.
pub struct RecitationRepo<'a> {
    conn: &'a Connection,
}

impl<'a> RecitationRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// Records that the file for `global_ayah` is cached (upsert — a re-fetch
    /// after a partial/corrupt file updates the row in place).
    pub fn mark_cached(
        &self,
        global_ayah: u32,
        file_path: &str,
        size_bytes: u64,
        fetched_at: &str,
    ) -> rusqlite::Result<()> {
        self.conn.execute(
            "INSERT INTO recitation (global_ayah, file_path, size_bytes, fetched_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(global_ayah) DO UPDATE SET
                 file_path = excluded.file_path,
                 size_bytes = excluded.size_bytes,
                 fetched_at = excluded.fetched_at",
            params![global_ayah, file_path, size_bytes as i64, fetched_at],
        )?;
        Ok(())
    }

    /// Returns the cached-file record for `global_ayah`, or `None` when not cached.
    pub fn get(&self, global_ayah: u32) -> rusqlite::Result<Option<CachedAudio>> {
        self.conn
            .query_row(
                "SELECT global_ayah, file_path, size_bytes, fetched_at
                 FROM recitation WHERE global_ayah = ?1",
                [global_ayah],
                |row| {
                    Ok(CachedAudio {
                        global_ayah: row.get::<_, i64>(0)? as u32,
                        file_path: row.get(1)?,
                        size_bytes: row.get::<_, i64>(2)? as u64,
                        fetched_at: row.get(3)?,
                    })
                },
            )
            .optional()
    }

    /// Returns the cached global ayah numbers in `[start, end]`, ascending.
    pub fn cached_in_range(&self, start: u32, end: u32) -> rusqlite::Result<Vec<u32>> {
        let mut stmt = self.conn.prepare(
            "SELECT global_ayah FROM recitation
             WHERE global_ayah BETWEEN ?1 AND ?2
             ORDER BY global_ayah",
        )?;
        let rows = stmt.query_map(params![start, end], |row| row.get::<_, i64>(0))?;
        rows.map(|r| r.map(|v| v as u32)).collect()
    }
}

#[cfg(test)]
mod tests {
    use crate::storage::{test_memory_db, RecitationRepo};

    #[test]
    fn mark_cached_then_get_roundtrip() {
        let conn = test_memory_db();
        let repo = RecitationRepo::new(&conn);

        repo.mark_cached(1, "recitation/1.mp3", 146830, "2026-08-20T12:00:00Z")
            .unwrap();

        let cached = repo.get(1).unwrap().expect("ayah 1 must be cached");
        assert_eq!(cached.global_ayah, 1);
        assert_eq!(cached.file_path, "recitation/1.mp3");
        assert_eq!(cached.size_bytes, 146830);
        assert_eq!(cached.fetched_at, "2026-08-20T12:00:00Z");
    }

    #[test]
    fn get_returns_none_when_not_cached() {
        let conn = test_memory_db();
        let repo = RecitationRepo::new(&conn);

        assert!(repo.get(1).unwrap().is_none());
        assert!(repo.get(6236).unwrap().is_none());
    }

    #[test]
    fn mark_cached_upserts_without_duplicating_row() {
        let conn = test_memory_db();
        let repo = RecitationRepo::new(&conn);

        repo.mark_cached(8, "recitation/8.mp3", 1000, "2026-08-20T12:00:00Z")
            .unwrap();
        repo.mark_cached(8, "recitation/8.mp3", 1200, "2026-08-21T09:00:00Z")
            .unwrap();

        let cached = repo.get(8).unwrap().expect("ayah 8 must be cached");
        assert_eq!(cached.size_bytes, 1200);
        assert_eq!(cached.fetched_at, "2026-08-21T09:00:00Z");

        let rows: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM recitation WHERE global_ayah = 8",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(rows, 1, "upsert must not duplicate the row");
    }

    #[test]
    fn cached_in_range_returns_only_cached_ayahs_in_order() {
        let conn = test_memory_db();
        let repo = RecitationRepo::new(&conn);
        for global in [7u32, 8, 10, 11] {
            repo.mark_cached(
                global,
                &format!("recitation/{global}.mp3"),
                1,
                "2026-08-20T00:00:00Z",
            )
            .unwrap();
        }

        assert_eq!(repo.cached_in_range(8, 10).unwrap(), vec![8, 10]);
        assert_eq!(repo.cached_in_range(1, 6236).unwrap(), vec![7, 8, 10, 11]);
    }

    #[test]
    fn cached_in_range_on_empty_index_returns_empty() {
        let conn = test_memory_db();
        let repo = RecitationRepo::new(&conn);

        assert!(repo.cached_in_range(1, 6236).unwrap().is_empty());
    }

    #[test]
    fn mark_cached_rejects_global_ayah_outside_quran_range() {
        let conn = test_memory_db();
        let repo = RecitationRepo::new(&conn);

        assert!(repo.mark_cached(0, "recitation/0.mp3", 1, "x").is_err());
        assert!(repo
            .mark_cached(6237, "recitation/6237.mp3", 1, "x")
            .is_err());
    }
}
