use chrono::{DateTime, Utc};

use crate::prayer::PrayerTimes;

/// Returns the next upcoming prayer (among the 5 daily prayers, sunrise excluded)
/// after `now` for the given `times`. Returns `None` if all prayers for the day
/// have passed. The caller may then compute tomorrow's times to find the next Fajr.
///
/// Not implemented — Red phase stub.
pub fn next_prayer(_times: &PrayerTimes, _now: DateTime<Utc>) -> Option<(String, DateTime<Utc>)> {
    None
}

/// Whether a prayer-time trigger should fire / emit given persisted toggles.
/// Per spec toggles default enabled; trigger should fire only when *both*
/// notification and adhan are enabled. Stub returns false to force Red failure.
pub fn should_fire(_notification_enabled: bool, _adhan_enabled: bool) -> bool {
    false
}

/// Given today's and tomorrow's prayer times, returns the next prayer instant.
/// If today's next is Some, returns it; otherwise returns tomorrow's Fajr.
/// Stub returns None.
pub fn next_prayer_including_tomorrow(
    _today: &PrayerTimes,
    _tomorrow: &PrayerTimes,
    _now: DateTime<Utc>,
) -> Option<(String, DateTime<Utc>)> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};

    fn dt(s: &str) -> DateTime<Utc> {
        s.parse::<DateTime<Utc>>().unwrap()
    }

    fn sample_today() -> PrayerTimes {
        // Raleigh 2015-07-12 fixture — use UTC times from prayer engine
        PrayerTimes {
            fajr: "2015-07-12T09:02:00Z".to_string(),
            sunrise: "2015-07-12T10:08:00Z".to_string(),
            dhuhr: "2015-07-12T17:21:00Z".to_string(),
            asr: "2015-07-12T21:03:00Z".to_string(),
            maghrib: "2015-07-12T00:31:00Z".to_string(), // NOTE: intentionally not used? Use realistic set
            isha: "2015-07-12T01:46:00Z".to_string(),
        }
    }

    fn simple_day() -> PrayerTimes {
        PrayerTimes {
            fajr: "2025-08-20T02:00:00Z".to_string(),
            sunrise: "2025-08-20T03:00:00Z".to_string(),
            dhuhr: "2025-08-20T06:00:00Z".to_string(),
            asr: "2025-08-20T09:00:00Z".to_string(),
            maghrib: "2025-08-20T12:00:00Z".to_string(),
            isha: "2025-08-20T13:00:00Z".to_string(),
        }
    }

    fn simple_tomorrow() -> PrayerTimes {
        PrayerTimes {
            fajr: "2025-08-21T02:00:00Z".to_string(),
            sunrise: "2025-08-21T03:00:00Z".to_string(),
            dhuhr: "2025-08-21T06:00:00Z".to_string(),
            asr: "2025-08-21T09:00:00Z".to_string(),
            maghrib: "2025-08-21T12:00:00Z".to_string(),
            isha: "2025-08-21T13:00:00Z".to_string(),
        }
    }

    #[test]
    fn next_prayer_before_fajr_returns_fajr() {
        let times = simple_day();
        let now = dt("2025-08-20T01:00:00Z");
        let next = next_prayer(&times, now).expect("should be Fajr");
        assert_eq!(next.0, "fajr");
        assert_eq!(next.1, dt("2025-08-20T02:00:00Z"));
    }

    #[test]
    fn next_prayer_after_fajr_skips_sunrise_and_returns_dhuhr() {
        let times = simple_day();
        let now = dt("2025-08-20T02:30:00Z");
        let next = next_prayer(&times, now).expect("should be Dhuhr");
        assert_eq!(next.0, "dhuhr");
        assert_eq!(next.1, dt("2025-08-20T06:00:00Z"));
    }

    #[test]
    fn next_prayer_between_dhuhr_and_asr_returns_asr() {
        let times = simple_day();
        let now = dt("2025-08-20T07:00:00Z");
        let next = next_prayer(&times, now).expect("should be Asr");
        assert_eq!(next.0, "asr");
    }

    #[test]
    fn next_prayer_after_isha_returns_none() {
        let times = simple_day();
        let now = dt("2025-08-20T14:00:00Z");
        assert!(next_prayer(&times, now).is_none());
    }

    #[test]
    fn next_prayer_including_tomorrow_after_isha_returns_tomorrow_fajr() {
        let today = simple_day();
        let tomorrow = simple_tomorrow();
        let now = dt("2025-08-20T14:00:00Z");
        let next = next_prayer_including_tomorrow(&today, &tomorrow, now)
            .expect("should be tomorrow fajr");
        assert_eq!(next.0, "fajr");
        assert_eq!(next.1, dt("2025-08-21T02:00:00Z"));
    }

    #[test]
    fn should_fire_requires_both_toggles() {
        assert!(should_fire(true, true));
        assert!(!should_fire(true, false));
        assert!(!should_fire(false, true));
        assert!(!should_fire(false, false));
    }

    #[test]
    fn next_prayer_exact_time_advances_to_next() {
        let times = simple_day();
        // At exactly Fajr time, next should be Dhuhr (since we use > now, not >=)
        let now = dt("2025-08-20T02:00:00Z");
        let next = next_prayer(&times, now).expect("should advance");
        assert_eq!(next.0, "dhuhr");
    }
}
