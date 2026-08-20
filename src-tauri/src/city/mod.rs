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
}
