//! Umm al-Qura Hijri calendar conversion engine.
//!
//! All conversion is computed on-device via ICU4X `icu_calendar`
//! (`Hijri::new_umm_al_qura()`) — no network access. Dates are civil calendar
//! dates (no time component). Weekdays are encoded as `0 = Sunday .. 6 =
//! Saturday` for stable serialization to the frontend.

use chrono::{Datelike, NaiveDate};
use icu_calendar::cal::hijri::UmmAlQura;
use icu_calendar::cal::Hijri;
use icu_calendar::types::Weekday;
use icu_calendar::{Date, Iso};
use serde::{Deserialize, Serialize};

/// A date in the Umm al-Qura Hijri calendar. `month` and `day` are 1-based.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct HijriDate {
    pub year: i32,
    pub month: u8,
    pub day: u8,
}

/// A proleptic Gregorian (ISO) date. `month` and `day` are 1-based.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct GregorianDate {
    pub year: i32,
    pub month: u8,
    pub day: u8,
    /// 0 = Sunday .. 6 = Saturday.
    pub weekday: u8,
}

/// One cell of a Hijri month grid: a Hijri day with its Gregorian counterpart.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct GridDay {
    /// Hijri day of the month (1-based).
    pub hijri_day: u8,
    pub gregorian_year: i32,
    pub gregorian_month: u8,
    pub gregorian_day: u8,
    /// 0 = Sunday .. 6 = Saturday.
    pub weekday: u8,
    /// True when this day equals the app's local "today".
    pub is_today: bool,
}

/// All days of one Hijri month with their Gregorian counterparts.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MonthGrid {
    pub hijri_year: i32,
    pub hijri_month: u8,
    /// Number of days in the month (29 or 30 per Umm al-Qura).
    pub day_count: u8,
    pub days: Vec<GridDay>,
}

/// A Umm al-Qura calendar instance.
fn umm_al_qura() -> Hijri<UmmAlQura> {
    Hijri::new_umm_al_qura()
}

/// Convert a Gregorian (ISO) date to an Umm al-Qura Hijri date.
pub fn gregorian_to_hijri(year: i32, month: u8, day: u8) -> Result<HijriDate, String> {
    let iso = Date::try_new_iso(year, month, day)
        .map_err(|e| format!("invalid Gregorian date {year}-{month}-{day}: {e}"))?;
    let h = iso.to_calendar(umm_al_qura());
    Ok(HijriDate {
        year: h.era_year().year,
        month: h.month().ordinal,
        day: h.day_of_month().0,
    })
}

/// Convert an Umm al-Qura Hijri date to a Gregorian (ISO) date, including weekday.
pub fn hijri_to_gregorian(year: i32, month: u8, day: u8) -> Result<GregorianDate, String> {
    let h = Date::try_new_hijri_with_calendar(year, month, day, umm_al_qura())
        .map_err(|e| format!("invalid Hijri date {year}-{month}-{day}: {e}"))?;
    let g = h.to_calendar(Iso);
    Ok(GregorianDate {
        year: g.era_year().year,
        month: g.month().ordinal,
        day: g.day_of_month().0,
        weekday: weekday_index(g.weekday()),
    })
}

/// Number of days in a Hijri month (29 or 30 per Umm al-Qura).
pub fn days_in_hijri_month(year: i32, month: u8) -> Result<u8, String> {
    let first = Date::try_new_hijri_with_calendar(year, month, 1, umm_al_qura())
        .map_err(|e| format!("invalid Hijri month {year}-{month}: {e}"))?;
    Ok(first.days_in_month())
}

/// Build the full grid for one Hijri month. `today` is the local reference
/// date used to flag the current day.
pub fn month_grid(year: i32, month: u8, today: NaiveDate) -> Result<MonthGrid, String> {
    let count = days_in_hijri_month(year, month)?;
    let days = (1..=count)
        .map(|d| {
            let g = hijri_to_gregorian(year, month, d)?;
            Ok(GridDay {
                hijri_day: d,
                gregorian_year: g.year,
                gregorian_month: g.month,
                gregorian_day: g.day,
                weekday: g.weekday,
                is_today: NaiveDate::from_ymd_opt(g.year, g.month as u32, g.day as u32)
                    == Some(today),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(MonthGrid {
        hijri_year: year,
        hijri_month: month,
        day_count: count,
        days,
    })
}

/// Today's date in the OS local timezone (civil date, no time component).
pub fn today() -> NaiveDate {
    chrono::Local::now().date_naive()
}

/// Today's local date expressed in the Umm al-Qura Hijri calendar.
pub fn today_hijri() -> Result<HijriDate, String> {
    let t = today();
    gregorian_to_hijri(t.year(), t.month() as u8, t.day() as u8)
}

/// Map an ICU4X weekday to `0 = Sunday .. 6 = Saturday`.
fn weekday_index(w: Weekday) -> u8 {
    use Weekday::*;
    match w {
        Sunday => 0,
        Monday => 1,
        Tuesday => 2,
        Wednesday => 3,
        Thursday => 4,
        Friday => 5,
        Saturday => 6,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Datelike;

    fn date(y: i32, m: u8, d: u8) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m as u32, d as u32).unwrap()
    }

    // --- Gregorian → Hijri anchors (spec N3) ---

    #[test]
    fn gregorian_to_hijri_1_muharram_1448() {
        // 2026-06-16 (Tue) = 1 Muharram 1448 AH (Islamic New Year 1448).
        assert_eq!(
            gregorian_to_hijri(2026, 6, 16).unwrap(),
            HijriDate {
                year: 1448,
                month: 1,
                day: 1
            }
        );
    }

    #[test]
    fn gregorian_to_hijri_3_muharram_1448() {
        // 2026-06-18 (Thu) = 3 Muharram 1448 AH.
        assert_eq!(
            gregorian_to_hijri(2026, 6, 18).unwrap(),
            HijriDate {
                year: 1448,
                month: 1,
                day: 3
            }
        );
    }

    // --- Hijri → Gregorian anchor (spec N3) ---

    #[test]
    fn hijri_to_gregorian_10_dhu_al_hijjah_1447() {
        // 1447-12-10 = 2026-05-27 (Wed, weekday index 3).
        assert_eq!(
            hijri_to_gregorian(1447, 12, 10).unwrap(),
            GregorianDate {
                year: 2026,
                month: 5,
                day: 27,
                weekday: 3
            }
        );
    }

    // --- Round trips (spec AC-3) ---

    #[test]
    fn round_trip_hijri_across_1444_to_1450() {
        for year in 1444..=1450 {
            for month in 1..=12u8 {
                for day in 1..=30u8 {
                    if let Ok(g) = hijri_to_gregorian(year, month, day) {
                        let back = gregorian_to_hijri(g.year, g.month, g.day).unwrap();
                        assert_eq!(
                            (back.year, back.month, back.day),
                            (year, month, day),
                            "round trip failed for {year}-{month:02}-{day:02}"
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn round_trip_gregorian_sampled_2022_to_2029() {
        let start = date(2022, 1, 1);
        let end = date(2029, 12, 31);
        let mut cursor = start;
        while cursor <= end {
            let h = gregorian_to_hijri(cursor.year(), cursor.month() as u8, cursor.day() as u8)
                .unwrap();
            let back = hijri_to_gregorian(h.year, h.month, h.day).unwrap();
            assert_eq!(
                (back.year, back.month, back.day),
                (cursor.year(), cursor.month() as u8, cursor.day() as u8),
                "round trip failed for {cursor}"
            );
            cursor += chrono::TimeDelta::days(3);
        }
    }

    // --- Month lengths (spec FR-1/F2) ---

    #[test]
    fn hijri_months_are_29_or_30_days() {
        for year in 1440..=1460i32 {
            for month in 1..=12u8 {
                let len = days_in_hijri_month(year, month).unwrap();
                assert!(len == 29 || len == 30, "{year}-{month:02} has {len} days");
            }
        }
    }

    // --- Month grid (spec FR-2) ---

    #[test]
    fn month_grid_muharram_1448_starts_on_anchor_day() {
        // Reference "today" outside the month boundary question: 2026-06-18.
        let grid = month_grid(1448, 1, date(2026, 6, 18)).unwrap();
        assert_eq!(grid.hijri_year, 1448);
        assert_eq!(grid.hijri_month, 1);
        assert_eq!(grid.day_count, grid.days.len() as u8);
        assert!(grid.day_count == 29 || grid.day_count == 30);
        let first = &grid.days[0];
        assert_eq!(first.hijri_day, 1);
        assert_eq!(
            (
                first.gregorian_year,
                first.gregorian_month,
                first.gregorian_day
            ),
            (2026, 6, 16)
        );
        assert_eq!(first.weekday, 2, "2026-06-16 is a Tuesday");
    }

    #[test]
    fn month_grid_days_are_consecutive_gregorian_dates() {
        for (year, month) in [(1448, 1u8), (1448, 2u8), (1447, 12u8)] {
            let grid = month_grid(year, month, date(2030, 1, 1)).unwrap();
            for pair in grid.days.windows(2) {
                let a = date(
                    pair[0].gregorian_year,
                    pair[0].gregorian_month,
                    pair[0].gregorian_day,
                );
                let b = date(
                    pair[1].gregorian_year,
                    pair[1].gregorian_month,
                    pair[1].gregorian_day,
                );
                assert_eq!(b, a + chrono::TimeDelta::days(1));
                assert_eq!(pair[1].hijri_day, pair[0].hijri_day + 1);
            }
        }
    }

    #[test]
    fn month_grid_months_are_contiguous() {
        // Last day of month M + 1 day = first day of month M + 1.
        for (year, month, next_year, next_month) in [
            (1447, 12u8, 1448, 1u8),
            (1448, 1u8, 1448, 2u8),
            (1448, 2u8, 1448, 3u8),
        ] {
            let a = month_grid(year, month, date(2030, 1, 1)).unwrap();
            let b = month_grid(next_year, next_month, date(2030, 1, 1)).unwrap();
            let last = a.days.last().unwrap();
            let last_date = date(
                last.gregorian_year,
                last.gregorian_month,
                last.gregorian_day,
            );
            let first_next = b.days.first().unwrap();
            let first_date = date(
                first_next.gregorian_year,
                first_next.gregorian_month,
                first_next.gregorian_day,
            );
            assert_eq!(first_date, last_date + chrono::TimeDelta::days(1));
        }
    }

    #[test]
    fn month_grid_marks_exactly_one_today() {
        let grid = month_grid(1448, 1, date(2026, 6, 18)).unwrap();
        let marked: Vec<_> = grid.days.iter().filter(|d| d.is_today).collect();
        assert_eq!(marked.len(), 1);
        assert_eq!(marked[0].hijri_day, 3, "2026-06-18 is 3 Muharram 1448");
    }

    #[test]
    fn month_grid_marks_no_today_when_reference_date_is_outside() {
        let grid = month_grid(1448, 1, date(2027, 1, 1)).unwrap();
        assert!(!grid.days.iter().any(|d| d.is_today));
    }

    // --- Error handling ---

    #[test]
    fn rejects_invalid_gregorian_dates() {
        assert!(gregorian_to_hijri(2026, 13, 1).is_err());
        assert!(gregorian_to_hijri(2026, 2, 30).is_err());
    }

    #[test]
    fn rejects_invalid_hijri_dates() {
        assert!(hijri_to_gregorian(1448, 13, 1).is_err());
        assert!(hijri_to_gregorian(1448, 1, 31).is_err());
        assert!(days_in_hijri_month(1448, 0).is_err());
        assert!(days_in_hijri_month(1448, 13).is_err());
    }

    #[test]
    fn far_future_dates_are_computed_not_rejected() {
        // ICU4X extrapolates; must NOT error (spec FR-1/F4).
        assert!(gregorian_to_hijri(2200, 1, 1).is_ok());
        assert!(hijri_to_gregorian(1500, 1, 1).is_ok());
    }
}
