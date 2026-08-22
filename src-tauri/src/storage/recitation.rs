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

    /// Returns every cached row, ascending by global ayah.
    pub fn list_all(&self) -> rusqlite::Result<Vec<CachedAudio>> {
        let mut stmt = self.conn.prepare(
            "SELECT global_ayah, file_path, size_bytes, fetched_at
             FROM recitation ORDER BY global_ayah",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(CachedAudio {
                global_ayah: row.get::<_, i64>(0)? as u32,
                file_path: row.get(1)?,
                size_bytes: row.get::<_, i64>(2)? as u64,
                fetched_at: row.get(3)?,
            })
        })?;
        rows.collect()
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

/// Cache footprint of one surah with at least one cached ayah. Entries only
/// appear for surahs that actually have cached files (FR-5).
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct SurahCacheEntry {
    pub surah_id: u8,
    /// Number of *cached* ayahs in this surah.
    pub ayah_count: u32,
    /// Sum of the cached files' recorded sizes.
    pub size_bytes: u64,
}

/// Whole-index cache footprint grouped by surah boundaries from the bundled
/// Quran metadata.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct RecitationCacheSummary {
    pub total_bytes: u64,
    pub surahs: Vec<SurahCacheEntry>,
}

/// Aggregates the audio index into per-surah cache sizes in a single SQL
/// pass, grouping rows by the contiguous global-ayah ranges of the bundled
/// surah table.
pub fn cache_summary(conn: &Connection) -> rusqlite::Result<RecitationCacheSummary> {
    let mut stmt =
        conn.prepare("SELECT global_ayah, size_bytes FROM recitation ORDER BY global_ayah")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, i64>(0)? as u32, row.get::<_, i64>(1)? as u64))
    })?;
    let rows = rows.collect::<Result<Vec<_>, _>>()?;

    let mut summary = RecitationCacheSummary {
        total_bytes: 0,
        surahs: Vec::new(),
    };
    let mut idx = 0;
    let mut offset: u32 = 0; // globals consumed by preceding surahs
    for surah in crate::quran::all_surahs() {
        let last_global = offset + surah.ayah_count as u32;
        offset = last_global;
        if idx >= rows.len() {
            break;
        }
        let mut count: u32 = 0;
        let mut size: u64 = 0;
        while idx < rows.len() && rows[idx].0 <= last_global {
            size += rows[idx].1;
            count += 1;
            idx += 1;
        }
        if count > 0 {
            summary.total_bytes += size;
            summary.surahs.push(SurahCacheEntry {
                surah_id: surah.id,
                ayah_count: count,
                size_bytes: size,
            });
        }
    }
    Ok(summary)
}

#[cfg(test)]
mod tests {
    use crate::storage::recitation::SurahCacheEntry;
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

    // ── FR-5: cache summary ────────────────────────────────────────────────

    #[test]
    fn list_all_returns_every_row_ascending_by_global_ayah() {
        let conn = test_memory_db();
        let repo = RecitationRepo::new(&conn);
        for global in [300u32, 1, 9] {
            repo.mark_cached(
                global,
                &format!("recitation/{global}.mp3"),
                global as u64,
                "2026-08-22T00:00:00Z",
            )
            .unwrap();
        }

        let all = repo.list_all().unwrap();
        assert_eq!(
            all.iter().map(|a| a.global_ayah).collect::<Vec<_>>(),
            vec![1, 9, 300]
        );
        assert_eq!(all[0].size_bytes, 1);
        assert_eq!(all[1].size_bytes, 9);
        assert_eq!(all[2].size_bytes, 300);
    }

    #[test]
    fn list_all_on_empty_index_returns_empty() {
        let conn = test_memory_db();
        assert!(RecitationRepo::new(&conn).list_all().unwrap().is_empty());
    }

    #[test]
    fn cache_summary_groups_size_bytes_by_surah_boundaries() {
        let conn = test_memory_db();
        let repo = RecitationRepo::new(&conn);
        // Surah 1 spans globals 1..=7; surah 2 spans 8..=293.
        for (global, size) in [(1u32, 50u64), (7, 100), (9, 30), (10, 20), (293, 70)] {
            repo.mark_cached(
                global,
                &format!("recitation/{global}.mp3"),
                size,
                "2026-08-22T00:00:00Z",
            )
            .unwrap();
        }

        let summary = crate::storage::recitation::cache_summary(&conn).unwrap();
        assert_eq!(summary.total_bytes, 270);
        assert_eq!(
            summary.surahs,
            vec![
                SurahCacheEntry {
                    surah_id: 1,
                    ayah_count: 2,
                    size_bytes: 150
                },
                SurahCacheEntry {
                    surah_id: 2,
                    ayah_count: 3,
                    size_bytes: 120
                },
            ]
        );
    }

    #[test]
    fn cache_summary_on_empty_index_has_no_entries_and_zero_total() {
        let conn = test_memory_db();
        let summary = crate::storage::recitation::cache_summary(&conn).unwrap();
        assert_eq!(summary.total_bytes, 0);
        assert!(summary.surahs.is_empty());
    }
}
