//! Prayer log domain: logged prayers, on-time/qada classification, analytics.

use rusqlite::{params, Connection};

/// The five obligatory daily prayers, in canonical (daily) order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Prayer {
    Fajr,
    Dhuhr,
    Asr,
    Maghrib,
    Isha,
}

impl Prayer {
    /// All five prayers in daily order.
    pub const ALL: [Prayer; 5] = [
        Prayer::Fajr,
        Prayer::Dhuhr,
        Prayer::Asr,
        Prayer::Maghrib,
        Prayer::Isha,
    ];

    /// Stable string form used in storage and across the app boundary.
    pub fn as_str(self) -> &'static str {
        match self {
            Prayer::Fajr => "fajr",
            Prayer::Dhuhr => "dhuhr",
            Prayer::Asr => "asr",
            Prayer::Maghrib => "maghrib",
            Prayer::Isha => "isha",
        }
    }

    /// Parses a stored prayer name; `None` for anything that is not one of
    /// the five obligatory prayers (e.g. "sunrise").
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "fajr" => Some(Prayer::Fajr),
            "dhuhr" => Some(Prayer::Dhuhr),
            "asr" => Some(Prayer::Asr),
            "maghrib" => Some(Prayer::Maghrib),
            "isha" => Some(Prayer::Isha),
            _ => None,
        }
    }
}

/// Whether a prayer was performed within its time window (`OnTime`) or made
/// up afterwards (`Qada`). Captured once, at log time, and never re-graded.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogStatus {
    OnTime,
    Qada,
}

impl LogStatus {
    /// Stable string form used in storage.
    pub fn as_str(self) -> &'static str {
        match self {
            LogStatus::OnTime => "on_time",
            LogStatus::Qada => "qada",
        }
    }

    /// Parses a stored status string.
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "on_time" => Some(LogStatus::OnTime),
            "qada" => Some(LogStatus::Qada),
            _ => None,
        }
    }
}

/// A single logged prayer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LogEntry {
    /// Local calendar date the prayer belongs to (`YYYY-MM-DD`).
    pub log_date: String,
    pub prayer: Prayer,
    /// RFC3339 UTC instant the prayer was logged.
    pub logged_at: String,
    pub status: LogStatus,
}

/// Typed access to the `prayer_log` table.
pub struct PrayerLogRepo<'a> {
    conn: &'a Connection,
}

impl<'a> PrayerLogRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// Records a prayer. Fails when `(log_date, prayer)` is already logged.
    pub fn insert(
        &self,
        log_date: &str,
        prayer: Prayer,
        logged_at: &str,
        status: LogStatus,
    ) -> rusqlite::Result<()> {
        self.conn.execute(
            "INSERT INTO prayer_log (log_date, prayer, logged_at, status)
             VALUES (?1, ?2, ?3, ?4)",
            params![log_date, prayer.as_str(), logged_at, status.as_str()],
        )?;
        Ok(())
    }

    /// Deletes the entry for `(log_date, prayer)`. Returns rows removed (0 or 1).
    pub fn delete(&self, log_date: &str, prayer: Prayer) -> rusqlite::Result<usize> {
        self.conn.execute(
            "DELETE FROM prayer_log WHERE log_date = ?1 AND prayer = ?2",
            params![log_date, prayer.as_str()],
        )
    }

    /// All entries with `from <= log_date <= to`, ordered by date and then by
    /// canonical prayer order (Fajr → Isha).
    pub fn range(&self, from: &str, to: &str) -> rusqlite::Result<Vec<LogEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT log_date, prayer, logged_at, status FROM prayer_log
             WHERE log_date >= ?1 AND log_date <= ?2
             ORDER BY log_date,
                CASE prayer
                    WHEN 'fajr' THEN 0
                    WHEN 'dhuhr' THEN 1
                    WHEN 'asr' THEN 2
                    WHEN 'maghrib' THEN 3
                    WHEN 'isha' THEN 4
                END",
        )?;
        let rows = stmt.query_map(params![from, to], |row| {
            let prayer_str: String = row.get(1)?;
            let status_str: String = row.get(3)?;
            Ok(LogEntry {
                log_date: row.get(0)?,
                prayer: Prayer::parse(&prayer_str).ok_or(rusqlite::Error::InvalidQuery)?,
                logged_at: row.get(2)?,
                status: LogStatus::parse(&status_str).ok_or(rusqlite::Error::InvalidQuery)?,
            })
        })?;
        rows.collect()
    }
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::*;

    /// In-memory database with all migrations applied.
    fn db() -> Connection {
        crate::storage::test_memory_db()
    }

    #[test]
    fn insert_stores_entry() {
        let conn = db();
        let repo = PrayerLogRepo::new(&conn);

        repo.insert(
            "2026-08-20",
            Prayer::Fajr,
            "2026-08-20T04:30:00Z",
            LogStatus::OnTime,
        )
        .unwrap();

        let entries = repo.range("2026-08-01", "2026-08-31").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].log_date, "2026-08-20");
        assert_eq!(entries[0].prayer, Prayer::Fajr);
        assert_eq!(entries[0].logged_at, "2026-08-20T04:30:00Z");
        assert_eq!(entries[0].status, LogStatus::OnTime);
    }

    #[test]
    fn insert_rejects_duplicate_date_prayer() {
        let conn = db();
        let repo = PrayerLogRepo::new(&conn);
        repo.insert(
            "2026-08-20",
            Prayer::Fajr,
            "2026-08-20T04:30:00Z",
            LogStatus::OnTime,
        )
        .unwrap();

        assert!(repo
            .insert(
                "2026-08-20",
                Prayer::Fajr,
                "2026-08-20T04:31:00Z",
                LogStatus::OnTime
            )
            .is_err());
    }

    #[test]
    fn delete_removes_entry() {
        let conn = db();
        let repo = PrayerLogRepo::new(&conn);
        repo.insert(
            "2026-08-20",
            Prayer::Dhuhr,
            "2026-08-20T11:30:00Z",
            LogStatus::OnTime,
        )
        .unwrap();

        assert_eq!(repo.delete("2026-08-20", Prayer::Dhuhr).unwrap(), 1);
        assert!(repo.range("2026-08-01", "2026-08-31").unwrap().is_empty());

        // Deleting a missing entry is a no-op, not an error.
        assert_eq!(repo.delete("2026-08-20", Prayer::Dhuhr).unwrap(), 0);
    }

    #[test]
    fn range_orders_by_date_then_prayer() {
        let conn = db();
        let repo = PrayerLogRepo::new(&conn);
        // Insert out of order; expect canonical ordering back.
        repo.insert(
            "2026-08-20",
            Prayer::Dhuhr,
            "2026-08-20T11:30:00Z",
            LogStatus::OnTime,
        )
        .unwrap();
        repo.insert(
            "2026-08-19",
            Prayer::Maghrib,
            "2026-08-19T17:00:00Z",
            LogStatus::Qada,
        )
        .unwrap();
        repo.insert(
            "2026-08-20",
            Prayer::Fajr,
            "2026-08-20T04:30:00Z",
            LogStatus::OnTime,
        )
        .unwrap();

        let got: Vec<(String, Prayer)> = repo
            .range("2026-08-01", "2026-08-31")
            .unwrap()
            .iter()
            .map(|e| (e.log_date.clone(), e.prayer))
            .collect();
        assert_eq!(
            got,
            vec![
                ("2026-08-19".to_string(), Prayer::Maghrib),
                ("2026-08-20".to_string(), Prayer::Fajr),
                ("2026-08-20".to_string(), Prayer::Dhuhr),
            ]
        );
    }

    #[test]
    fn range_excludes_dates_outside_window() {
        let conn = db();
        let repo = PrayerLogRepo::new(&conn);
        let seeded: [(&str, Prayer); 3] = [
            ("2026-08-18", Prayer::Isha),
            ("2026-08-19", Prayer::Fajr),
            ("2026-08-20", Prayer::Isha),
        ];
        for (date, prayer) in seeded {
            repo.insert(date, prayer, "2026-08-20T02:00:00Z", LogStatus::Qada)
                .unwrap();
        }

        let got: Vec<String> = repo
            .range("2026-08-19", "2026-08-20")
            .unwrap()
            .iter()
            .map(|e| e.log_date.clone())
            .collect();
        assert_eq!(got, vec!["2026-08-19", "2026-08-20"]);
    }

    #[test]
    fn range_on_empty_database_returns_empty() {
        let conn = db();
        let repo = PrayerLogRepo::new(&conn);

        assert!(repo.range("2026-08-01", "2026-08-31").unwrap().is_empty());
    }
}

#[cfg(test)]
mod classify_tests {
    use super::*;
    use jiff::Timestamp;

    /// 2025-08-20 00:00:00 UTC, as unix seconds.
    const DAY0: i64 = 1_755_648_000;

    /// Instant `mins` minutes after the test day's 00:00 UTC.
    fn ts(mins: i64) -> Timestamp {
        Timestamp::from_second(DAY0 + mins * 60).expect("valid timestamp")
    }

    /// Fixed test-day windows:
    /// fajr 04:30, sunrise 05:45, dhuhr 12:05, asr 15:30, maghrib 18:02,
    /// isha 19:20, next-day fajr 04:35 (crosses midnight).
    fn windows() -> DayWindows {
        DayWindows {
            fajr: ts(4 * 60 + 30),
            sunrise: ts(5 * 60 + 45),
            dhuhr: ts(12 * 60 + 5),
            asr: ts(15 * 60 + 30),
            maghrib: ts(18 * 60 + 2),
            isha: ts(19 * 60 + 20),
            next_fajr: ts(24 * 60 + 4 * 60 + 35),
        }
    }

    #[test]
    fn fajr_within_window_is_on_time() {
        assert_eq!(
            classify(Prayer::Fajr, ts(4 * 60 + 35), &windows()),
            LogStatus::OnTime
        );
    }

    #[test]
    fn fajr_after_sunrise_is_qada() {
        assert_eq!(
            classify(Prayer::Fajr, ts(6 * 60), &windows()),
            LogStatus::Qada
        );
    }

    #[test]
    fn fajr_exactly_at_window_start_is_on_time() {
        assert_eq!(
            classify(Prayer::Fajr, ts(4 * 60 + 30), &windows()),
            LogStatus::OnTime
        );
    }

    #[test]
    fn fajr_exactly_at_window_end_is_qada() {
        assert_eq!(
            classify(Prayer::Fajr, ts(5 * 60 + 45), &windows()),
            LogStatus::Qada
        );
    }

    #[test]
    fn dhuhr_window_bounded_by_asr() {
        assert_eq!(
            classify(Prayer::Dhuhr, ts(13 * 60), &windows()),
            LogStatus::OnTime
        );
        assert_eq!(
            classify(Prayer::Dhuhr, ts(16 * 60), &windows()),
            LogStatus::Qada
        );
    }

    #[test]
    fn asr_window_bounded_by_maghrib() {
        assert_eq!(
            classify(Prayer::Asr, ts(17 * 60), &windows()),
            LogStatus::OnTime
        );
        assert_eq!(
            classify(Prayer::Asr, ts(19 * 60), &windows()),
            LogStatus::Qada
        );
    }

    #[test]
    fn maghrib_window_bounded_by_isha() {
        assert_eq!(
            classify(Prayer::Maghrib, ts(18 * 60 + 30), &windows()),
            LogStatus::OnTime
        );
        assert_eq!(
            classify(Prayer::Maghrib, ts(20 * 60), &windows()),
            LogStatus::Qada
        );
    }

    #[test]
    fn isha_window_crosses_midnight_to_next_fajr() {
        assert_eq!(
            classify(Prayer::Isha, ts(21 * 60), &windows()),
            LogStatus::OnTime
        );
        // 03:00 on the following calendar day is still before next-day fajr (04:35).
        assert_eq!(
            classify(Prayer::Isha, ts(24 * 60 + 3 * 60), &windows()),
            LogStatus::OnTime
        );
        // After next-day fajr the window has closed.
        assert_eq!(
            classify(Prayer::Isha, ts(24 * 60 + 5 * 60), &windows()),
            LogStatus::Qada
        );
    }
}
