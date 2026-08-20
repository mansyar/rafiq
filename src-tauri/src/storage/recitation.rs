//! Recitation audio index: which per-ayah MP3s are cached locally.

#[cfg(test)]
mod tests {
    use crate::storage::{test_memory_db, RecitationRepo};

    // Red — audio recitation track, Phase 2: `RecitationRepo` is implemented
    // in the Green step.

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
