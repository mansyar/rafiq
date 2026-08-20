use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

/// City entry bundled in `src-tauri/assets/cities.json`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct City {
    pub id: String,
    pub name: String,
    pub country: String,
    pub country_code: String,
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: String,
}

/// Embedded JSON — loaded once at runtime.
static CITIES_JSON: &str = include_str!("../../assets/cities.json");

static CITIES: OnceLock<Vec<City>> = OnceLock::new();

/// Parse and memoize the embedded dataset. Panics only if the embedded JSON is malformed
/// (which is a build-time invariant; validated by `dataset_validation` test).
pub fn all_cities() -> &'static [City] {
    CITIES.get_or_init(|| {
        serde_json::from_str(CITIES_JSON).expect("cities.json must be valid JSON array of City")
    })
}

/// Return a cloned vec (convenience for callers that need ownership).
pub fn load_cities() -> Vec<City> {
    all_cities().to_vec()
}

/// Validate coordinate ranges — shared with commands validation.
pub fn validate_coordinates(latitude: f64, longitude: f64) -> Result<(), String> {
    if !latitude.is_finite() || !longitude.is_finite() {
        return Err("coordinates must be finite numbers".to_string());
    }
    if !(-90.0..=90.0).contains(&latitude) {
        return Err(format!("latitude {latitude} out of range -90..90"));
    }
    if !(-180.0..=180.0).contains(&longitude) {
        return Err(format!("longitude {longitude} out of range -180..180"));
    }
    Ok(())
}

/// Parse a coordinate string (e.g., from manual lat/long input) with friendly errors.
pub fn parse_coordinate(s: &str) -> Result<f64, String> {
    // TODO: Red phase stub — intentionally not implemented yet
    let _ = s;
    Err("not implemented".to_string())
}

/// Search cities by name/country substring, case-insensitive, ranked, capped at `limit`.
pub fn search_cities(query: &str, limit: usize) -> Vec<City> {
    let _ = (query, limit);
    // TODO: Red phase stub — return empty to drive failing tests
    Vec::new()
}

/// Find a city by its unique `id`.
pub fn find_city_by_id(city_id: &str) -> Option<City> {
    let _ = city_id;
    // TODO: Red phase stub
    None
}

/// Result of `resolve_location` — either a city-backed or manual coordinate.
#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedLocation {
    pub city: Option<City>,
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: String,
}

/// Resolve a location: `city_id` → city coordinates, or manual `latitude`/`longitude` fallback.
/// Returns friendly errors for missing/invalid inputs.
pub fn resolve_location(
    city_id: Option<&str>,
    latitude: Option<f64>,
    longitude: Option<f64>,
) -> Result<ResolvedLocation, String> {
    let _ = (city_id, latitude, longitude);
    // TODO: Red phase stub
    Err("not implemented".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn dataset_loads_and_has_at_least_3000_entries() {
        let cities = all_cities();
        assert!(
            cities.len() >= 3000,
            "expected >=3000 cities, got {}",
            cities.len()
        );
    }

    #[test]
    fn dataset_required_fields_present_and_coordinates_in_range() {
        let cities = all_cities();
        for city in cities {
            assert!(!city.id.trim().is_empty(), "empty id for {:?}", city);
            assert!(
                !city.name.trim().is_empty(),
                "empty name for id {}",
                city.id
            );
            assert!(
                !city.country.trim().is_empty(),
                "empty country for id {}",
                city.id
            );
            assert!(
                !city.country_code.trim().is_empty(),
                "empty country_code for id {}",
                city.id
            );
            assert!(
                !city.timezone.trim().is_empty(),
                "empty timezone for id {}",
                city.id
            );
            assert!(
                (-90.0..=90.0).contains(&city.latitude),
                "latitude out of range for {}: {}",
                city.id,
                city.latitude
            );
            assert!(
                (-180.0..=180.0).contains(&city.longitude),
                "longitude out of range for {}: {}",
                city.id,
                city.longitude
            );
            assert!(
                city.latitude.is_finite() && city.longitude.is_finite(),
                "non-finite coordinates for {}",
                city.id
            );
        }
    }

    #[test]
    fn dataset_unique_city_ids() {
        let cities = all_cities();
        let mut seen = HashSet::new();
        for city in cities {
            assert!(
                seen.insert(&city.id),
                "duplicate city id found: {}",
                city.id
            );
        }
    }

    #[test]
    fn validate_coordinates_accepts_valid_and_rejects_invalid() {
        assert!(validate_coordinates(-6.2088, 106.8456).is_ok());
        assert!(validate_coordinates(0.0, 0.0).is_ok());
        assert!(validate_coordinates(90.0, 180.0).is_ok());
        assert!(validate_coordinates(-90.0, -180.0).is_ok());
        assert!(validate_coordinates(91.0, 0.0).is_err());
        assert!(validate_coordinates(0.0, 181.0).is_err());
        assert!(validate_coordinates(f64::NAN, 0.0).is_err());
        assert!(validate_coordinates(f64::INFINITY, 0.0).is_err());
    }

    // ── 2.2 Red phase: search, parse, resolution ──────────────────────────

    #[test]
    fn search_returns_jakarta_for_jakarta_query() {
        let results = search_cities("Jakarta", 5);
        assert!(
            !results.is_empty(),
            "expected at least one result for 'Jakarta'"
        );
        assert!(
            results
                .iter()
                .any(|c| c.name == "Jakarta" && c.country == "Indonesia"),
            "expected Jakarta, Indonesia in results: got {:?}",
            results.iter().map(|c| &c.name).collect::<Vec<_>>()
        );
    }

    #[test]
    fn search_is_case_insensitive() {
        let lower = search_cities("jakarta", 5);
        let upper = search_cities("JAKARTA", 5);
        assert_eq!(
            lower.len(),
            upper.len(),
            "case-insensitive search should return same count"
        );
        assert!(!lower.is_empty(), "lower-case query should return results");
    }

    #[test]
    fn search_ranking_prefix_first() {
        let results = search_cities("jak", 5);
        assert!(!results.is_empty(), "expected results for 'jak'");
        // Jakarta should rank first for prefix "jak" over e.g., "Banjarmasin Jakarta"?
        assert_eq!(
            results[0].name, "Jakarta",
            "expected Jakarta first for prefix 'jak', got {:?}",
            results[0]
        );
    }

    #[test]
    fn search_by_country_substring_returns_indonesian_cities() {
        let results = search_cities("Indonesia", 10);
        assert_eq!(results.len(), 10, "expected 10 results for limit 10");
        for city in &results {
            assert_eq!(
                city.country, "Indonesia",
                "expected Indonesian city, got {:?}",
                city
            );
        }
    }

    #[test]
    fn search_empty_query_returns_empty() {
        assert!(search_cities("", 5).is_empty());
        assert!(search_cities("   ", 5).is_empty());
    }

    #[test]
    fn search_not_found_returns_empty() {
        assert!(search_cities("xyznotfound123", 5).is_empty());
    }

    #[test]
    fn search_respects_limit() {
        let results = search_cities("a", 5);
        assert_eq!(results.len(), 5, "expected exactly 5 results for limit 5");
        let results2 = search_cities("a", 2);
        assert_eq!(results2.len(), 2);
    }

    #[test]
    fn find_city_by_id_returns_correct_city() {
        // pick a known Jakarta id dynamically
        let jakarta = all_cities()
            .iter()
            .find(|c| c.name == "Jakarta" && c.country == "Indonesia")
            .expect("Jakarta must exist in dataset");
        let found = find_city_by_id(&jakarta.id);
        assert!(found.is_some(), "expected to find Jakarta by id");
        assert_eq!(found.unwrap().id, jakarta.id);
    }

    #[test]
    fn find_city_by_id_returns_none_for_unknown() {
        assert!(find_city_by_id("non-existent-id-99999").is_none());
    }

    #[test]
    fn parse_coordinate_valid() {
        assert_eq!(parse_coordinate("-6.2088").unwrap(), -6.2088);
        assert_eq!(parse_coordinate("106.8456").unwrap(), 106.8456);
        assert_eq!(parse_coordinate(" 0 ").unwrap(), 0.0);
    }

    #[test]
    fn parse_coordinate_invalid_returns_friendly_error() {
        let err = parse_coordinate("abc").unwrap_err();
        assert!(
            err.to_lowercase().contains("number") || err.to_lowercase().contains("parse"),
            "expected friendly parse error, got: {err}"
        );
        let err2 = parse_coordinate("").unwrap_err();
        assert!(!err2.is_empty());
    }

    #[test]
    fn resolve_location_city_id_valid() {
        let jakarta = all_cities()
            .iter()
            .find(|c| c.name == "Jakarta" && c.country == "Indonesia")
            .unwrap();
        let resolved =
            resolve_location(Some(&jakarta.id), None, None).expect("should resolve Jakarta");
        assert_eq!(resolved.latitude, jakarta.latitude);
        assert_eq!(resolved.longitude, jakarta.longitude);
        assert!(resolved.city.is_some());
        assert_eq!(resolved.city.unwrap().id, jakarta.id);
    }

    #[test]
    fn resolve_location_city_id_invalid_returns_error() {
        let err = resolve_location(Some("does-not-exist-123"), None, None).unwrap_err();
        assert!(
            err.to_lowercase().contains("not found") || err.to_lowercase().contains("city"),
            "expected city not found error, got: {err}"
        );
    }

    #[test]
    fn resolve_location_manual_valid() {
        let resolved =
            resolve_location(None, Some(-6.2), Some(106.8)).expect("manual should resolve");
        assert_eq!(resolved.latitude, -6.2);
        assert_eq!(resolved.longitude, 106.8);
        assert!(resolved.city.is_none());
    }

    #[test]
    fn resolve_location_manual_invalid_rejected() {
        assert!(resolve_location(None, Some(91.0), Some(0.0)).is_err());
        assert!(resolve_location(None, Some(0.0), Some(200.0)).is_err());
    }

    #[test]
    fn resolve_location_no_input_returns_error() {
        let err = resolve_location(None, None, None).unwrap_err();
        assert!(!err.is_empty());
    }

    #[test]
    fn resolve_location_city_takes_precedence_over_manual() {
        let jakarta = all_cities()
            .iter()
            .find(|c| c.name == "Jakarta" && c.country == "Indonesia")
            .unwrap();
        let resolved = resolve_location(Some(&jakarta.id), Some(0.0), Some(0.0))
            .expect("city should take precedence");
        assert_eq!(resolved.latitude, jakarta.latitude);
        assert_eq!(resolved.longitude, jakarta.longitude);
    }
}
