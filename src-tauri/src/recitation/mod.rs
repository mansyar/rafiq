//! Recitation audio: on-demand per-ayah download + permanent local cache.
//!
//! Source: Islamic Network CDN (license verified 2026-08-20 — see
//! `src-tauri/assets/ATTRIBUTION.md`). Audio is downloaded only on explicit
//! user action and cached forever in `{app_data}/recitation/{global_ayah}.mp3`.

use std::path::{Path, PathBuf};

use chrono::{SecondsFormat, Utc};
use rusqlite::Connection;

use crate::storage::{CachedAudio, RecitationRepo};

/// The reciter's name, displayed beside the player (FR-1.3).
pub const RECITER_NAME: &str = "Mishary Rashid Alafasy";
/// Reciter edition on the Islamic Network CDN (Mishary Rashid Alafasy, Murattal).
/// Single configurable constant — swap here if the source changes (takedown contingency).
pub const EDITION: &str = "ar.alafasy";
/// Fixed bitrate per product design.
pub const BITRATE: &str = "128";
/// CDN base for per-ayah audio.
const CDN_BASE: &str = "https://cdn.islamic.network/quran/audio";

/// Builds the CDN URL for one global ayah (1..=6236).
pub fn ayah_url(global_ayah: u32) -> String {
    format!("{CDN_BASE}/{BITRATE}/{EDITION}/{global_ayah}.mp3")
}

/// Final cache location for one global ayah: `{app_data}/recitation/{n}.mp3`.
pub fn cache_file_path(cache_dir: &Path, global_ayah: u32) -> PathBuf {
    cache_dir
        .join("recitation")
        .join(format!("{global_ayah}.mp3"))
}

/// Temporary file written during a download; renamed over the final path on success.
pub fn temp_file_path(cache_dir: &Path, global_ayah: u32) -> PathBuf {
    cache_dir
        .join("recitation")
        .join(format!("{global_ayah}.mp3.part"))
}

/// Cache state for one ayah. A valid cache is an index row plus a non-empty
/// file at the canonical path; anything else (never downloaded, orphaned row,
/// partial/corrupt file) is `Missing` and will be re-fetched.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CacheState {
    Cached,
    Missing,
}

/// Decides whether an ayah can be served from cache or must be downloaded.
pub fn cache_state(cache_dir: &Path, conn: &Connection, global_ayah: u32) -> CacheState {
    let indexed = RecitationRepo::new(conn)
        .get(global_ayah)
        .ok()
        .flatten()
        .is_some();
    let file_valid = cache_file_path(cache_dir, global_ayah)
        .metadata()
        .map(|m| m.len() > 0)
        .unwrap_or(false);
    if indexed && file_valid {
        CacheState::Cached
    } else {
        CacheState::Missing
    }
}

/// Writes `bytes` to `temp_path`, then renames over `final_path` — the final
/// path only ever contains a complete file.
pub fn write_atomic(bytes: &[u8], temp_path: &Path, final_path: &Path) -> std::io::Result<()> {
    if let Some(parent) = final_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(temp_path, bytes)?;
    std::fs::rename(temp_path, final_path)?;
    Ok(())
}

/// Installs downloaded bytes into the cache (atomic write) and records the
/// audio index. Rejects empty downloads.
pub fn complete_fetch(
    cache_dir: &Path,
    conn: &Connection,
    global_ayah: u32,
    bytes: &[u8],
) -> Result<CachedAudio, String> {
    if bytes.is_empty() {
        return Err("downloaded file is empty".to_string());
    }
    let final_path = cache_file_path(cache_dir, global_ayah);
    write_atomic(bytes, &temp_file_path(cache_dir, global_ayah), &final_path)
        .map_err(|e| format!("failed to write recitation cache: {e}"))?;
    let fetched_at = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);
    let file_path = final_path.to_string_lossy().into_owned();
    let size_bytes = bytes.len() as u64;
    RecitationRepo::new(conn)
        .mark_cached(global_ayah, &file_path, size_bytes, &fetched_at)
        .map_err(|e| format!("failed to record recitation index: {e}"))?;
    Ok(CachedAudio {
        global_ayah,
        file_path,
        size_bytes,
        fetched_at,
    })
}

pub(crate) fn try_e2e_fixture_bytes(global_ayah: u32) -> Option<Vec<u8>> {
    if std::env::var("TAURI_E2E").as_deref() != Ok("1") || global_ayah != 1 {
        return None;
    }
    // 1) Explicit override via env var
    if let Ok(p) = std::env::var("TAURI_E2E_FIXTURE_PATH") {
        let trimmed = p.trim();
        if !trimmed.is_empty() {
            if let Ok(b) = std::fs::read(trimmed) {
                if !b.is_empty() {
                    return Some(b);
                }
            }
        }
    }
    // 2) Crate manifest dir is `src-tauri`; `../e2e/fixtures/ayah-1.mp3` is the canonical location.
    let manifest_fixture =
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../e2e/fixtures/ayah-1.mp3");
    if let Ok(b) = std::fs::read(&manifest_fixture) {
        if !b.is_empty() {
            return Some(b);
        }
    }
    // 3) Fallback: probe a few CWD-relative candidates (covers `cargo test` CWD variations).
    for candidate in [
        "e2e/fixtures/ayah-1.mp3",
        "../e2e/fixtures/ayah-1.mp3",
        "../../e2e/fixtures/ayah-1.mp3",
        "../../../e2e/fixtures/ayah-1.mp3",
    ] {
        if let Ok(b) = std::fs::read(candidate) {
            if !b.is_empty() {
                return Some(b);
            }
        }
    }
    None
}

/// Downloads the MP3 for `global_ayah` from the CDN (no cache logic —
/// callers check [`cache_state`] first). When `TAURI_E2E=1` and
/// `global_ayah==1`, returns the bundled `e2e/fixtures/ayah-1.mp3` fixture
/// instead of hitting the network, so E2E tests pass offline.
pub async fn download(client: &reqwest::Client, global_ayah: u32) -> Result<Vec<u8>, String> {
    if let Some(bytes) = try_e2e_fixture_bytes(global_ayah) {
        return Ok(bytes);
    }
    let url = ayah_url(global_ayah);
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("recitation download failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "recitation download failed: HTTP {}",
            response.status()
        ));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("recitation download failed: {e}"))?;
    Ok(bytes.to_vec())
}

/// Removes the cached files for the deleted rows. Missing files are
/// tolerated (the index deletion is authoritative); other IO errors bubble.
fn remove_cache_files(rows: &[CachedAudio]) -> std::io::Result<()> {
    for row in rows {
        let path = PathBuf::from(&row.file_path);
        match std::fs::remove_file(&path) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e),
        }
    }
    Ok(())
}

/// Deletes one surah's cached ayahs: index rows **and** files. Missing files
/// are tolerated. Returns the freed byte count from the index (FR-5). Files
/// are resolved from each row's recorded path (index-authoritative), so
/// `cache_dir` is accepted only for signature symmetry with the fetch path.
pub fn delete_surah_cache(
    cache_dir: &Path,
    conn: &Connection,
    surah_id: u8,
) -> Result<u64, String> {
    let surah =
        crate::quran::get_surah(surah_id).ok_or_else(|| format!("unknown surah: {surah_id}"))?;
    let first_global = crate::quran::global_ayah(surah_id, 1)
        .ok_or_else(|| format!("unknown surah: {surah_id}"))?;
    let last_global = first_global + surah.ayah_count as u32 - 1;
    let repo = RecitationRepo::new(conn);
    let rows = repo
        .delete_in_range(first_global, last_global)
        .map_err(|e| format!("failed to delete recitation index rows: {e}"))?;
    let freed = rows.iter().map(|r| r.size_bytes).sum();
    remove_cache_files(&rows).map_err(|e| format!("failed to remove cached files: {e}"))?;
    Ok(freed)
}

/// Deletes every cached ayah: all index rows **and** files. Returns the
/// freed byte count from the index (FR-5). See `delete_surah_cache` for the
/// role of `cache_dir`.
pub fn delete_all_cache(cache_dir: &Path, conn: &Connection) -> Result<u64, String> {
    let repo = RecitationRepo::new(conn);
    let rows = repo
        .delete_all()
        .map_err(|e| format!("failed to clear recitation index: {e}"))?;
    let freed = rows.iter().map(|r| r.size_bytes).sum();
    remove_cache_files(&rows).map_err(|e| format!("failed to remove cached files: {e}"))?;
    Ok(freed)
}

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

    #[test]
    fn e2e_fixture_is_used_when_tauri_e2e_set() {
        let orig_e2e = std::env::var("TAURI_E2E").ok();
        let orig_path = std::env::var("TAURI_E2E_FIXTURE_PATH").ok();

        // Without env → no fixture
        unsafe { std::env::remove_var("TAURI_E2E") };
        unsafe { std::env::remove_var("TAURI_E2E_FIXTURE_PATH") };
        assert!(
            crate::recitation::try_e2e_fixture_bytes(1).is_none(),
            "fixture must not fire without TAURI_E2E=1"
        );
        assert!(
            crate::recitation::try_e2e_fixture_bytes(2).is_none(),
            "only ayah 1 is mocked"
        );

        // With env → ayah 1 returns bytes, other ayahs still None
        unsafe { std::env::set_var("TAURI_E2E", "1") };
        let bytes = crate::recitation::try_e2e_fixture_bytes(1)
            .expect("ayah 1 fixture must be present when TAURI_E2E=1");
        assert!(!bytes.is_empty(), "fixture bytes must be non-empty");
        assert!(
            bytes.starts_with(b"ID3"),
            "fixture should start with ID3 header"
        );
        assert!(
            crate::recitation::try_e2e_fixture_bytes(2).is_none(),
            "only ayah 1 is mocked even with TAURI_E2E=1"
        );
        assert!(
            crate::recitation::try_e2e_fixture_bytes(6236).is_none(),
            "far ayah still not mocked"
        );

        // Cleanup
        match orig_e2e {
            Some(v) => unsafe { std::env::set_var("TAURI_E2E", v) },
            None => unsafe { std::env::remove_var("TAURI_E2E") },
        }
        match orig_path {
            Some(v) => unsafe { std::env::set_var("TAURI_E2E_FIXTURE_PATH", v) },
            None => unsafe { std::env::remove_var("TAURI_E2E_FIXTURE_PATH") },
        }
    }

    // ── FR-5: cache deletion ───────────────────────────────────────────────

    use crate::recitation::{delete_all_cache, delete_surah_cache};

    #[test]
    fn delete_surah_cache_removes_rows_and_files_for_that_surah_only() {
        let dir = cache_dir();
        let conn = conn();
        // Surah 1 (globals 1..=7): two files; Surah 2 (8..): one file.
        with_indexed_file(&dir, &conn, 1, Some(100));
        with_indexed_file(&dir, &conn, 7, Some(250));
        with_indexed_file(&dir, &conn, 8, Some(400));

        let freed = delete_surah_cache(&dir, &conn, 1).expect("delete surah 1");
        assert_eq!(freed, 350, "freed bytes must equal the surah's rows");

        let repo = RecitationRepo::new(&conn);
        assert!(repo.get(1).unwrap().is_none(), "row 1 deleted");
        assert!(repo.get(7).unwrap().is_none(), "row 7 deleted");
        assert!(repo.get(8).unwrap().is_some(), "surah 2 row kept");
        assert!(!cache_file_path(&dir, 1).exists(), "file 1 removed");
        assert!(!cache_file_path(&dir, 7).exists(), "file 7 removed");
        assert!(
            cache_file_path(&dir, 8).exists(),
            "surah 2 file must survive"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn delete_surah_cache_tolerates_already_missing_files() {
        let dir = cache_dir();
        let conn = conn();
        with_indexed_file(&dir, &conn, 1, Some(100));
        // Simulate a file that vanished outside the app's knowledge.
        fs::remove_file(cache_file_path(&dir, 1)).unwrap();

        let freed = delete_surah_cache(&dir, &conn, 1).expect("missing file tolerated");
        assert_eq!(freed, 100, "bytes come from the index, not the disk");
        assert!(RecitationRepo::new(&conn).get(1).unwrap().is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn delete_all_cache_clears_every_row_and_file() {
        let dir = cache_dir();
        let conn = conn();
        with_indexed_file(&dir, &conn, 3, Some(120));
        with_indexed_file(&dir, &conn, 9, Some(340));

        let freed = delete_all_cache(&dir, &conn).expect("delete all");
        assert_eq!(freed, 460);
        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM recitation", [], |r| r.get(0))
            .unwrap();
        assert_eq!(remaining, 0, "index must be empty");
        assert!(!cache_file_path(&dir, 3).exists());
        assert!(!cache_file_path(&dir, 9).exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn delete_surah_cache_rejects_unknown_surah() {
        let dir = cache_dir();
        let conn = conn();
        assert!(delete_surah_cache(&dir, &conn, 115).is_err());
        let _ = fs::remove_dir_all(&dir);
    }
}
