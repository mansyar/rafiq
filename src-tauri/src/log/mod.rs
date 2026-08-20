//! Prayer log domain: logged prayers, on-time/qada classification, analytics.

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

        let got: Vec<&str> = repo
            .range("2026-08-19", "2026-08-20")
            .unwrap()
            .iter()
            .map(|e| e.log_date.as_str())
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
