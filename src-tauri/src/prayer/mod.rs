//! Prayer-time calculation domain types and service.

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;

    use super::*;

    #[test]
    fn muslim_world_league_reference_fixture_is_within_one_minute() {
        let times = calculate_prayer_times(
            NaiveDate::from_ymd_opt(2015, 7, 12).unwrap(),
            Coordinates {
                latitude: 35.7750,
                longitude: -78.6336,
            },
            CalculationMethod::MuslimWorldLeague,
        )
        .unwrap();

        assert_time_within_one_minute(&times.fajr, "2015-07-12T08:19:00Z");
        assert_time_within_one_minute(&times.sunrise, "2015-07-12T10:07:00Z");
        assert_time_within_one_minute(&times.dhuhr, "2015-07-12T17:22:00Z");
        assert_time_within_one_minute(&times.asr, "2015-07-12T22:22:00Z");
        assert_time_within_one_minute(&times.maghrib, "2015-07-13T00:32:00Z");
        assert_time_within_one_minute(&times.isha, "2015-07-13T02:01:00Z");
    }

    #[test]
    fn calculation_method_exposes_the_seven_supported_methods() {
        let methods = [
            CalculationMethod::MuslimWorldLeague,
            CalculationMethod::Isna,
            CalculationMethod::Egyptian,
            CalculationMethod::UmmAlQura,
            CalculationMethod::Karachi,
            CalculationMethod::Tehran,
            CalculationMethod::Jafari,
        ];

        assert_eq!(methods.len(), 7);
        assert_eq!(
            CalculationMethod::default(),
            CalculationMethod::MuslimWorldLeague
        );
    }

    #[test]
    fn prayer_times_serialize_with_the_six_expected_fields() {
        let times = PrayerTimes {
            fajr: "05:00".to_string(),
            sunrise: "06:15".to_string(),
            dhuhr: "12:00".to_string(),
            asr: "15:30".to_string(),
            maghrib: "18:00".to_string(),
            isha: "19:30".to_string(),
        };

        let value = serde_json::to_value(times).unwrap();
        assert_eq!(value["fajr"], "05:00");
        assert_eq!(value["sunrise"], "06:15");
        assert_eq!(value["dhuhr"], "12:00");
        assert_eq!(value["asr"], "15:30");
        assert_eq!(value["maghrib"], "18:00");
        assert_eq!(value["isha"], "19:30");
    }

    fn assert_time_within_one_minute(actual: &str, expected: &str) {
        let actual = chrono::DateTime::parse_from_rfc3339(actual).unwrap();
        let expected = chrono::DateTime::parse_from_rfc3339(expected).unwrap();
        let difference = (actual - expected).num_seconds().abs();
        assert!(
            difference <= 60,
            "expected {expected}, found {actual} ({difference}s difference)"
        );
    }
}
