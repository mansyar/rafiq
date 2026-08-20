//! Recitation audio: on-demand per-ayah download + permanent local cache.
//!
//! Source: Islamic Network CDN (license verified 2026-08-20 — see
//! `src-tauri/assets/ATTRIBUTION.md`). Audio is downloaded only on explicit
//! user action and cached forever in `{app_data}/recitation/{global_ayah}.mp3`.

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    use rusqlite::Connection;

    use crate::recitation::{
        cache_file_path, cache_state, complete_fetch, temp_file_path, write_atomic, CacheState,
        EDITION,
    };
    use crate::storage::{test_memory_db, RecitationRepo};

    /// Unique temp directory per test (no extra dev-dependencies).
    fn cache_dir() -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock before epoch")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "rafiq_recitation_test_{}_{}",
            std::process::id(),
            unique
        ));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn conn() -> Connection {
        test_memory_db()
    }

    /// Records an index row for `global_ayah` (canonical file path) and, when
    /// `bytes` is `Some`, writes a file of that size at the canonical path.
    fn with_indexed_file(
        cache_dir: &Path,
        conn: &Connection,
        global_ayah: u32,
        bytes: Option<usize>,
    ) {
        let path = cache_file_path(cache_dir, global_ayah);
        let mut size: u64 = 0;
        if let Some(n) = bytes {
            fs::create_dir_all(path.parent().expect("parent")).unwrap();
            fs::write(&path, vec![0u8; n]).unwrap();
            size = n as u64;
        }
        RecitationRepo::new(conn)
            .mark_cached(
                global_ayah,
                path.to_string_lossy().as_ref(),
                size,
                "2026-08-20T12:00:00Z",
            )
            .expect("mark cached");
    }

    #[test]
    fn url_uses_fixed_bitrate_edition_and_global_ayah() {
        assert_eq!(EDITION, "ar.alafasy");
        let url = crate::recitation::ayah_url(1);
        assert_eq!(
            url,
            "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3"
        );
        assert!(crate::recitation::ayah_url(6236).ends_with("/audio/128/ar.alafasy/6236.mp3"));
    }

    #[test]
    fn cache_and_temp_paths_under_recitation_dir() {
        let dir = cache_dir();
        let final_path = cache_file_path(&dir, 7);
        assert_eq!(final_path, dir.join("recitation").join("7.mp3"));
        let temp = temp_file_path(&dir, 7);
        assert_eq!(temp, dir.join("recitation").join("7.mp3.part"));
        assert_ne!(temp, final_path);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn cache_state_missing_on_empty_database() {
        let dir = cache_dir();
        let conn = conn();
        assert_eq!(cache_state(&dir, &conn, 1), CacheState::Missing);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn cache_state_cached_when_indexed_and_file_present() {
        let dir = cache_dir();
        let conn = conn();
        with_indexed_file(&dir, &conn, 7, Some(146830));
        assert_eq!(cache_state(&dir, &conn, 7), CacheState::Cached);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn cache_state_missing_when_file_absent() {
        // Orphaned index row (e.g. cache folder moved) → re-fetch, never crash.
        let dir = cache_dir();
        let conn = conn();
        with_indexed_file(&dir, &conn, 7, None);
        assert_eq!(cache_state(&dir, &conn, 7), CacheState::Missing);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn cache_state_missing_when_file_empty() {
        // Partial/corrupt download (0 bytes) → re-fetch.
        let dir = cache_dir();
        let conn = conn();
        with_indexed_file(&dir, &conn, 7, Some(0));
        assert_eq!(cache_state(&dir, &conn, 7), CacheState::Missing);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_atomic_installs_file_and_removes_temp() {
        let dir = cache_dir();
        let final_path = cache_file_path(&dir, 7);
        let temp = temp_file_path(&dir, 7);
        write_atomic(b"fake-mp3-bytes", &temp, &final_path).expect("write atomic");
        assert_eq!(
            fs::read(&final_path).expect("read final"),
            b"fake-mp3-bytes"
        );
        assert!(!temp.exists(), "temp file must be renamed away");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_atomic_creates_missing_parent_dirs() {
        let dir = cache_dir();
        let final_path = dir.join("nested").join("deeper").join("7.mp3");
        let temp = dir.join("nested").join("deeper").join("7.mp3.part");
        write_atomic(b"x", &temp, &final_path).expect("write atomic");
        assert!(final_path.exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn complete_fetch_installs_file_and_records_index() {
        let dir = cache_dir();
        let conn = conn();
        let audio = complete_fetch(&dir, &conn, 7, b"fake-mp3-bytes").expect("complete fetch");
        assert_eq!(audio.global_ayah, 7);
        assert_eq!(audio.size_bytes, b"fake-mp3-bytes".len() as u64);
        let final_path = cache_file_path(&dir, 7);
        assert_eq!(
            fs::read(&final_path).expect("read final"),
            b"fake-mp3-bytes"
        );
        assert!(
            !temp_file_path(&dir, 7).exists(),
            "no temp file left behind"
        );
        let row = RecitationRepo::new(&conn)
            .get(7)
            .expect("get row")
            .expect("indexed");
        assert_eq!(row.file_path, final_path.to_string_lossy());
        assert_eq!(row.size_bytes, audio.size_bytes);
        assert_eq!(cache_state(&dir, &conn, 7), CacheState::Cached);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn complete_fetch_rejects_empty_download() {
        let dir = cache_dir();
        let conn = conn();
        assert!(complete_fetch(&dir, &conn, 7, b"").is_err());
        assert!(
            !cache_file_path(&dir, 7).exists(),
            "no file for empty download"
        );
        assert!(
            !temp_file_path(&dir, 7).exists(),
            "no temp file for empty download"
        );
        assert!(
            RecitationRepo::new(&conn)
                .get(7)
                .expect("get row")
                .is_none(),
            "no index row"
        );
        let _ = fs::remove_dir_all(&dir);
    }
}
