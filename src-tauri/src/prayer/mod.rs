//! Prayer-time calculation domain types and service.

use adhan::{Method, Parameters, Prayer, PrayerTimes as AdhanPrayerTimes};
use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};

/// Supported prayer-time calculation methods.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CalculationMethod {
    /// Muslim World League (the application default).
    #[default]
    MuslimWorldLeague,
    /// Islamic Society of North America.
    Isna,
    /// Egyptian General Authority of Survey.
    Egyptian,
    /// Umm al-Qura University, Makkah.
    UmmAlQura,
    /// University of Islamic Sciences, Karachi.
    Karachi,
    /// Institute of Geophysics, University of Tehran.
    Tehran,
    /// Jafari calculation method.
    Jafari,
}

/// Geographic coordinates used by the prayer calculator.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Coordinates {
    /// Latitude in degrees, from -90 to 90.
    pub latitude: f64,
    /// Longitude in degrees, from -180 to 180.
    pub longitude: f64,
}

/// The six prayer and sunrise instants returned by the calculator.
///
/// Values are RFC 3339 UTC strings. A location timezone can convert these
/// instants for display without changing the underlying calculation result.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PrayerTimes {
    /// Fajr prayer time.
    pub fajr: String,
    /// Sunrise time.
    pub sunrise: String,
    /// Dhuhr prayer time.
    pub dhuhr: String,
    /// Asr prayer time using the standard (non-Hanafi) shadow length.
    pub asr: String,
    /// Maghrib prayer time.
    pub maghrib: String,
    /// Isha prayer time.
    pub isha: String,
}

/// Calculates the six daily prayer times for a Gregorian date and location.
///
/// The underlying `adhaan` crate's default high-latitude rule and nearest-city
/// polar-circle resolver are intentionally retained.
pub fn calculate_prayer_times(
    date: NaiveDate,
    coordinates: Coordinates,
    method: CalculationMethod,
) -> Result<PrayerTimes, String> {
    validate_coordinates(coordinates)?;

    let date = jiff::civil::Date::new(
        i16::try_from(date.year()).map_err(|_| "date year is out of range".to_string())?,
        i8::try_from(date.month()).map_err(|_| "date month is out of range".to_string())?,
        i8::try_from(date.day()).map_err(|_| "date day is out of range".to_string())?,
    )
    .map_err(|error| format!("invalid date: {error}"))?;

    let coordinates = adhan::Coordinates {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
    };
    let schedule = AdhanPrayerTimes::calculate(date, coordinates, method.parameters())
        .map_err(|error| format!("could not calculate prayer times: {error:?}"))?;

    Ok(PrayerTimes {
        fajr: format_time(schedule.time_of(Prayer::Fajr)),
        sunrise: format_time(schedule.time_of(Prayer::Sunrise)),
        dhuhr: format_time(schedule.time_of(Prayer::Dhuhr)),
        asr: format_time(schedule.time_of(Prayer::AsrAwwal)),
        maghrib: format_time(schedule.time_of(Prayer::Maghrib)),
        isha: format_time(schedule.time_of(Prayer::Isha)),
    })
}

impl CalculationMethod {
    fn parameters(self) -> Parameters {
        Parameters::new(self.method())
    }

    fn method(self) -> &'static dyn Method {
        match self {
            Self::MuslimWorldLeague => &adhan::prominent_methods::MuslimWorldLeague,
            Self::Isna => &adhan::prominent_methods::NorthAmerica,
            Self::Egyptian => &adhan::prominent_methods::Egyptian,
            Self::UmmAlQura => &adhan::prominent_methods::UmmAlQura,
            Self::Karachi => &adhan::prominent_methods::Karachi,
            Self::Tehran => &adhan::prominent_methods::Tehran,
            Self::Jafari => &JAFARI_METHOD,
        }
    }
}

#[derive(Debug)]
struct JafariMethod;

impl Method for JafariMethod {
    fn fajr_angle(&self) -> f64 {
        16.0
    }

    fn isha_angle(&self) -> f64 {
        14.0
    }

    fn maghrib_angle(&self) -> f64 {
        4.0
    }
}

static JAFARI_METHOD: JafariMethod = JafariMethod;

fn validate_coordinates(coordinates: Coordinates) -> Result<(), String> {
    if !coordinates.latitude.is_finite() || !(-90.0..=90.0).contains(&coordinates.latitude) {
        return Err("latitude must be a finite value between -90 and 90".to_string());
    }
    if !coordinates.longitude.is_finite() || !(-180.0..=180.0).contains(&coordinates.longitude) {
        return Err("longitude must be a finite value between -180 and 180".to_string());
    }
    Ok(())
}

fn format_time(time: jiff::Zoned) -> String {
    time.strftime("%Y-%m-%dT%H:%M:%SZ").to_string()
}

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

        assert_time_within_one_minute(&times.fajr, "2015-07-12T08:21:00Z");
        assert_time_within_one_minute(&times.sunrise, "2015-07-12T10:07:00Z");
        assert_time_within_one_minute(&times.dhuhr, "2015-07-12T17:21:00Z");
        assert_time_within_one_minute(&times.asr, "2015-07-12T21:09:00Z");
        assert_time_within_one_minute(&times.maghrib, "2015-07-13T00:32:00Z");
        assert_time_within_one_minute(&times.isha, "2015-07-13T02:11:00Z");
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
    fn every_supported_method_produces_six_prayer_times() {
        let date = NaiveDate::from_ymd_opt(2024, 3, 20).unwrap();
        let coordinates = Coordinates {
            latitude: 1.3521,
            longitude: 103.8198,
        };

        for method in [
            CalculationMethod::MuslimWorldLeague,
            CalculationMethod::Isna,
            CalculationMethod::Egyptian,
            CalculationMethod::UmmAlQura,
            CalculationMethod::Karachi,
            CalculationMethod::Tehran,
            CalculationMethod::Jafari,
        ] {
            let times = calculate_prayer_times(date, coordinates, method).unwrap();
            assert!(
                [
                    &times.fajr,
                    &times.sunrise,
                    &times.dhuhr,
                    &times.asr,
                    &times.maghrib,
                    &times.isha,
                ]
                .iter()
                .all(|time| !time.is_empty()),
                "method {method:?} returned an empty prayer time"
            );
        }
    }

    #[test]
    fn invalid_coordinates_are_rejected_before_calculation() {
        let date = NaiveDate::from_ymd_opt(2024, 3, 20).unwrap();

        let latitude_error = calculate_prayer_times(
            date,
            Coordinates {
                latitude: 90.1,
                longitude: 0.0,
            },
            CalculationMethod::default(),
        )
        .unwrap_err();
        assert_eq!(
            latitude_error,
            "latitude must be a finite value between -90 and 90"
        );

        let longitude_error = calculate_prayer_times(
            date,
            Coordinates {
                latitude: 0.0,
                longitude: -180.1,
            },
            CalculationMethod::default(),
        )
        .unwrap_err();
        assert_eq!(
            longitude_error,
            "longitude must be a finite value between -180 and 180"
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
