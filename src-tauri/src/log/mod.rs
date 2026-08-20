//! Prayer log domain: logged prayers, on-time/qada classification, analytics.

use chrono::NaiveDate;
use jiff::Timestamp;
use rusqlite::{params, Connection};
use std::collections::BTreeMap;

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

/// A day's prayer-time windows as absolute UTC instants.
///
/// Each obligatory prayer has a half-open window `[start, end)`: it opens at
/// the prayer's own time and closes when the next element of the chain
/// Fajr → Sunrise → Dhuhr → Asr → Maghrib → Isha → next-day Fajr begins.
/// Isha's window crosses midnight and is closed by the following day's Fajr.
#[derive(Debug, Clone, Copy)]
pub struct DayWindows {
    pub fajr: Timestamp,
    pub sunrise: Timestamp,
    pub dhuhr: Timestamp,
    pub asr: Timestamp,
    pub maghrib: Timestamp,
    pub isha: Timestamp,
    /// The next day's Fajr — closes Isha's window.
    pub next_fajr: Timestamp,
}

impl DayWindows {
    /// The `[start, end)` window for `prayer` (start inclusive, end exclusive).
    fn window(&self, prayer: Prayer) -> (Timestamp, Timestamp) {
        match prayer {
            Prayer::Fajr => (self.fajr, self.sunrise),
            Prayer::Dhuhr => (self.dhuhr, self.asr),
            Prayer::Asr => (self.asr, self.maghrib),
            Prayer::Maghrib => (self.maghrib, self.isha),
            Prayer::Isha => (self.isha, self.next_fajr),
        }
    }
}

/// Classifies a logged prayer by the prayer-window rule (spec FR-2):
/// `OnTime` when `logged_at` falls inside the prayer's window, `Qada` otherwise.
pub fn classify(prayer: Prayer, logged_at: Timestamp, windows: &DayWindows) -> LogStatus {
    let (start, end) = windows.window(prayer);
    if logged_at >= start && logged_at < end {
        LogStatus::OnTime
    } else {
        LogStatus::Qada
    }
}

/// Streaks of complete days, where a complete day has all five prayers logged.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Streaks {
    /// Consecutive complete days ending at `today` — or at `yesterday` when
    /// today is not complete yet (an unfinished day never breaks a streak).
    pub current: u32,
    /// Longest run of consecutive complete days in the logged history.
    pub best: u32,
}

/// Computes the current and best streaks from logged entries.
///
/// A day counts as complete when all five obligatory prayers are logged; the
/// on-time/qada status of individual prayers does not matter (make-up prayers
/// still count — the point is the habit, not perfection). Entries whose
/// `log_date` is not a valid `YYYY-MM-DD` date are ignored.
pub fn compute_streaks(entries: &[LogEntry], today: NaiveDate) -> Streaks {
    let mut prayers_per_day: BTreeMap<NaiveDate, u32> = BTreeMap::new();
    for entry in entries {
        if let Ok(date) = NaiveDate::parse_from_str(&entry.log_date, "%Y-%m-%d") {
            *prayers_per_day.entry(date).or_insert(0) += 1;
        }
    }
    let complete: Vec<NaiveDate> = prayers_per_day
        .into_iter()
        .filter(|(_, count)| *count >= Prayer::ALL.len() as u32)
        .map(|(date, _)| date)
        .collect();

    // Current run: walk backwards from today, or from yesterday when today is
    // still incomplete.
    let mut current = 0u32;
    let mut cursor = complete
        .contains(&today)
        .then_some(today)
        .or_else(|| today.pred_opt());
    while let Some(day) = &cursor {
        if !complete.contains(day) {
            break;
        }
        current += 1;
        cursor = day.pred_opt();
    }

    Streaks {
        current,
        best: longest_run(&complete),
    }
}

/// Length of the longest run of consecutive days in a sorted, unique date vec.
fn longest_run(dates: &[NaiveDate]) -> u32 {
    let mut best = 0u32;
    let mut run = 0u32;
    let mut prev: Option<NaiveDate> = None;
    for date in dates {
        run = match prev {
            Some(p) if p.succ_opt().as_ref() == Some(date) => run + 1,
            _ => 1,
        };
        best = best.max(run);
        prev = Some(*date);
    }
    best
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

#[cfg(test)]
mod streak_tests {
    use super::*;
    use chrono::NaiveDate;

    fn d(value: &str) -> NaiveDate {
        NaiveDate::parse_from_str(value, "%Y-%m-%d").unwrap()
    }

    fn entry(log_date: &str, prayer: Prayer) -> LogEntry {
        LogEntry {
            log_date: log_date.to_string(),
            prayer,
            logged_at: format!("{log_date}T12:00:00Z"),
            status: LogStatus::OnTime,
        }
    }

    /// All five prayers for one day.
    fn day(log_date: &str) -> Vec<LogEntry> {
        Prayer::ALL.iter().map(|p| entry(log_date, *p)).collect()
    }

    #[test]
    fn empty_history_has_no_streaks() {
        assert_eq!(
            compute_streaks(&[], d("2026-08-20")),
            Streaks {
                current: 0,
                best: 0
            }
        );
    }

    #[test]
    fn complete_today_gives_current_streak_of_one() {
        let entries = day("2026-08-20");
        assert_eq!(
            compute_streaks(&entries, d("2026-08-20")),
            Streaks {
                current: 1,
                best: 1
            }
        );
    }

    #[test]
    fn consecutive_complete_days_accumulate() {
        let mut entries = day("2026-08-19");
        entries.extend(day("2026-08-20"));
        assert_eq!(
            compute_streaks(&entries, d("2026-08-20")),
            Streaks {
                current: 2,
                best: 2
            }
        );
    }

    #[test]
    fn incomplete_today_does_not_break_streak() {
        // Today has only Fajr so far; the run ending yesterday still counts.
        let mut entries = day("2026-08-18");
        entries.extend(day("2026-08-19"));
        entries.push(entry("2026-08-20", Prayer::Fajr));
        assert_eq!(
            compute_streaks(&entries, d("2026-08-20")),
            Streaks {
                current: 2,
                best: 2
            }
        );
    }

    #[test]
    fn gap_day_breaks_current_streak() {
        // 2026-08-17 complete, 18/19 empty, today incomplete -> no live streak.
        let entries = day("2026-08-17");
        assert_eq!(
            compute_streaks(&entries, d("2026-08-20")),
            Streaks {
                current: 0,
                best: 1
            }
        );
    }

    #[test]
    fn best_survives_across_multiple_gaps() {
        let mut entries: Vec<LogEntry> = Vec::new();
        for date in ["2026-08-01", "2026-08-02", "2026-08-03"] {
            entries.extend(day(date));
        }
        for date in [
            "2026-08-10",
            "2026-08-11",
            "2026-08-12",
            "2026-08-13",
            "2026-08-14",
        ] {
            entries.extend(day(date));
        }
        assert_eq!(
            compute_streaks(&entries, d("2026-08-20")),
            Streaks {
                current: 0,
                best: 5
            }
        );
    }

    #[test]
    fn qada_logs_still_count_toward_day_complete() {
        let mut entries = day("2026-08-20");
        entries[0] = LogEntry {
            status: LogStatus::Qada,
            ..entries[0].clone()
        };
        assert_eq!(
            compute_streaks(&entries, d("2026-08-20")),
            Streaks {
                current: 1,
                best: 1
            }
        );
    }

    #[test]
    fn incomplete_days_do_not_count() {
        // Three prayers on the 19th, one on the 20th, interleaved:
        // no complete day at all, regardless of entry order.
        let entries = vec![
            entry("2026-08-19", Prayer::Fajr),
            entry("2026-08-20", Prayer::Fajr),
            entry("2026-08-19", Prayer::Dhuhr),
            entry("2026-08-19", Prayer::Asr),
        ];
        assert_eq!(
            compute_streaks(&entries, d("2026-08-20")),
            Streaks {
                current: 0,
                best: 0
            }
        );
    }
}

#[cfg(test)]
mod monthly_tests {
    use super::*;
    use chrono::NaiveDate;

    fn d(value: &str) -> NaiveDate {
        NaiveDate::parse_from_str(value, "%Y-%m-%d").unwrap()
    }

    fn entry(log_date: &str, prayer: Prayer) -> LogEntry {
        LogEntry {
            log_date: log_date.to_string(),
            prayer,
            logged_at: format!("{log_date}T12:00:00Z"),
            status: LogStatus::OnTime,
        }
    }

    fn entry_qada(log_date: &str, prayer: Prayer) -> LogEntry {
        LogEntry {
            status: LogStatus::Qada,
            ..entry(log_date, prayer)
        }
    }

    fn day(log_date: &str) -> Vec<LogEntry> {
        Prayer::ALL.iter().map(|p| entry(log_date, *p)).collect()
    }

    #[test]
    fn empty_month_has_zero_summary() {
        // Mid-month: today is the 20th, so 20 days (100 prayer slots) have elapsed.
        let summary = monthly_summary(&[], d("2026-08-20"));
        assert_eq!(summary.days_elapsed, 20);
        assert_eq!(summary.complete_days, 0);
        assert_eq!(summary.completion_pct, 0.0);
        assert_eq!(summary.on_time, 0);
        assert_eq!(summary.qada, 0);
        assert_eq!(summary.missed, 100);
        assert_eq!(summary.on_time_pct, 0.0);
        assert_eq!(summary.qada_pct, 0.0);
        assert_eq!(summary.missed_pct, 100.0);
    }

    #[test]
    fn partial_day_counts_in_breakdown() {
        // Today: 3 on-time + 2 qada -> the day is complete, 5 of 100 slots used.
        let entries = vec![
            entry("2026-08-20", Prayer::Fajr),
            entry("2026-08-20", Prayer::Dhuhr),
            entry("2026-08-20", Prayer::Asr),
            entry_qada("2026-08-20", Prayer::Maghrib),
            entry_qada("2026-08-20", Prayer::Isha),
        ];
        let summary = monthly_summary(&entries, d("2026-08-20"));
        assert_eq!(summary.days_elapsed, 20);
        assert_eq!(summary.complete_days, 1);
        assert_eq!(summary.completion_pct, 5.0);
        assert_eq!(summary.on_time, 3);
        assert_eq!(summary.qada, 2);
        assert_eq!(summary.missed, 95);
        assert_eq!(summary.on_time_pct, 3.0);
        assert_eq!(summary.qada_pct, 2.0);
        assert_eq!(summary.missed_pct, 95.0);
    }

    #[test]
    fn mixed_month_completion_and_breakdown() {
        // Days 1-10 complete (all on-time) + day 11 with 2 on-time and 3 qada.
        let mut entries: Vec<LogEntry> = Vec::new();
        for day_num in 1..=10u32 {
            entries.extend(day(&format!("2026-08-{day_num:02}")));
        }
        entries.push(entry("2026-08-11", Prayer::Fajr));
        entries.push(entry("2026-08-11", Prayer::Dhuhr));
        for prayer in [Prayer::Asr, Prayer::Maghrib, Prayer::Isha] {
            entries.push(entry_qada("2026-08-11", prayer));
        }
        let summary = monthly_summary(&entries, d("2026-08-20"));
        assert_eq!(summary.days_elapsed, 20);
        assert_eq!(summary.complete_days, 11);
        assert_eq!(summary.completion_pct, 55.0);
        assert_eq!(summary.on_time, 52);
        assert_eq!(summary.qada, 3);
        assert_eq!(summary.missed, 45);
        assert_eq!(summary.on_time_pct, 52.0);
        assert_eq!(summary.qada_pct, 3.0);
        assert_eq!(summary.missed_pct, 45.0);
    }

    #[test]
    fn entries_outside_month_or_in_future_are_ignored() {
        let mut entries = day("2026-07-31"); // previous month
        entries.extend(day("2026-08-21")); // future day (clock skew)
        entries.push(entry("2026-08-01", Prayer::Fajr));
        let summary = monthly_summary(&entries, d("2026-08-20"));
        assert_eq!(summary.days_elapsed, 20);
        assert_eq!(summary.complete_days, 0);
        assert_eq!(summary.completion_pct, 0.0);
        assert_eq!(summary.on_time, 1);
        assert_eq!(summary.qada, 0);
        assert_eq!(summary.missed, 99);
    }

    #[test]
    fn full_month_elapses_on_last_day() {
        // Every day of the 31-day month complete, all on-time.
        let mut entries: Vec<LogEntry> = Vec::new();
        for day_num in 1..=31u32 {
            entries.extend(day(&format!("2026-08-{day_num:02}")));
        }
        let summary = monthly_summary(&entries, d("2026-08-31"));
        assert_eq!(summary.days_elapsed, 31);
        assert_eq!(summary.complete_days, 31);
        assert_eq!(summary.completion_pct, 100.0);
        assert_eq!(summary.on_time, 155);
        assert_eq!(summary.qada, 0);
        assert_eq!(summary.missed, 0);
        assert_eq!(summary.on_time_pct, 100.0);
        assert_eq!(summary.qada_pct, 0.0);
        assert_eq!(summary.missed_pct, 0.0);
    }
}
