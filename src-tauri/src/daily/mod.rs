use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

/// Hadith entry bundled in `src-tauri/assets/daily/hadiths.json`.
///
/// Note: JSON key `id_translation` holds the Indonesian translation (locale `id`).
/// The spec shorthand `id, arabic, en, id, source` uses `id` for both the
/// stable identifier and the Indonesian locale code, which would be a duplicate
/// JSON key. We resolve by storing Indonesian as `id_translation`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Hadith {
    pub id: String,
    pub arabic: String,
    pub en: String,
    #[serde(rename = "id_translation")]
    pub id_translation: String,
    pub source: String,
}

/// Curated ayah reference — no duplicated Quran text.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AyahRef {
    pub id: String,
    pub surah_id: u8,
    pub ayah_number: u16,
}

// Bundled assets — validated at generation time.
static HADITHS_JSON: &str = include_str!("../../assets/daily/hadiths.json");
static AYAHS_JSON: &str = include_str!("../../assets/daily/ayahs.json");

static HADITHS: OnceLock<Vec<Hadith>> = OnceLock::new();
static AYAHS: OnceLock<Vec<AyahRef>> = OnceLock::new();

fn load_hadiths_inner() -> Vec<Hadith> {
    serde_json::from_str(HADITHS_JSON).expect("hadiths.json must be valid JSON array of Hadith")
}

fn load_ayahs_inner() -> Vec<AyahRef> {
    serde_json::from_str(AYAHS_JSON).expect("ayahs.json must be valid JSON array of AyahRef")
}

pub fn all_hadiths() -> &'static [Hadith] {
    HADITHS.get_or_init(load_hadiths_inner)
}

pub fn all_ayahs() -> &'static [AyahRef] {
    AYAHS.get_or_init(load_ayahs_inner)
}

pub fn load_hadiths() -> Vec<Hadith> {
    all_hadiths().to_vec()
}

pub fn load_ayahs() -> Vec<AyahRef> {
    all_ayahs().to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn hadiths_exactly_40_items() {
        assert_eq!(
            all_hadiths().len(),
            40,
            "hadiths.json must contain exactly 40 hadiths"
        );
    }

    #[test]
    fn hadiths_unique_ids() {
        let mut seen = HashSet::new();
        for h in all_hadiths() {
            assert!(seen.insert(&h.id), "duplicate hadith id: {}", h.id);
        }
    }

    #[test]
    fn hadiths_fields_non_empty() {
        for h in all_hadiths() {
            assert!(!h.id.trim().is_empty(), "empty id for hadith {:?}", h);
            assert!(!h.arabic.trim().is_empty(), "empty arabic for {}", h.id);
            assert!(!h.en.trim().is_empty(), "empty en for {}", h.id);
            assert!(
                !h.id_translation.trim().is_empty(),
                "empty id_translation for {}",
                h.id
            );
            assert!(!h.source.trim().is_empty(), "empty source for {}", h.id);
        }
    }

    #[test]
    fn hadiths_source_contains_nawawi_reference() {
        for h in all_hadiths() {
            assert!(
                h.source.contains("Nawawi"),
                "source must contain 'Nawawi' for {}: got {}",
                h.id,
                h.source
            );
        }
    }

    #[test]
    fn ayahs_exactly_365_items() {
        assert_eq!(
            all_ayahs().len(),
            365,
            "ayahs.json must contain 365 references"
        );
    }

    #[test]
    fn ayahs_unique_refs() {
        let mut seen = HashSet::new();
        for a in all_ayahs() {
            let key = (a.surah_id, a.ayah_number);
            assert!(seen.insert(key), "duplicate ayah ref: {:?}", key);
        }
    }

    #[test]
    fn ayahs_unique_ids() {
        let mut seen = HashSet::new();
        for a in all_ayahs() {
            assert!(seen.insert(&a.id), "duplicate ayah id: {}", a.id);
        }
    }

    #[test]
    fn ayahs_resolve_against_quran() {
        // Every curated ayah must resolve against bundled Quran data.
        // Uses crate::quran::global_ayah to validate surah/ayah bounds.
        for a in all_ayahs() {
            let global = crate::quran::global_ayah(a.surah_id, a.ayah_number);
            assert!(
                global.is_some(),
                "ayah {} ({}:{}) does not resolve against bundled Quran",
                a.id,
                a.surah_id,
                a.ayah_number
            );
        }
    }

    #[test]
    fn ayahs_no_duplicates_within_cycle() {
        // 365 distinct refs implies no duplicates within one full cycle.
        let ayahs = all_ayahs();
        let set: HashSet<(u8, u16)> = ayahs.iter().map(|a| (a.surah_id, a.ayah_number)).collect();
        assert_eq!(set.len(), ayahs.len(), "duplicates found within cycle");
        assert_eq!(set.len(), 365);
    }
}
