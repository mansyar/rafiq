use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ayah {
    pub number: u16,
    pub arabic: String,
    pub sahih: String,
    pub clear: String,
    pub kemenag: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Surah {
    pub id: u8,
    pub name_ar: String,
    pub name_transliteration: String,
    pub name_id: String,
    pub name_en: String,
    pub ayah_count: usize,
    pub revelation_type: String,
    pub ayahs: Vec<Ayah>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct QuranFile {
    surahs: Vec<Surah>,
}

static QURAN_JSON: &str = include_str!("../../assets/quran/quran.json");
static QURAN: OnceLock<Vec<Surah>> = OnceLock::new();

fn load_inner() -> Vec<Surah> {
    let file: QuranFile = serde_json::from_str(QURAN_JSON).expect("quran.json parse");
    file.surahs
}

pub fn all_surahs() -> &'static [Surah] {
    QURAN.get_or_init(load_inner)
}

pub fn load_quran() -> Vec<Surah> {
    all_surahs().to_vec()
}

pub fn get_surah(id: u8) -> Option<Surah> {
    all_surahs().iter().find(|s| s.id == id).cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dataset_has_114_surahs() {
        assert_eq!(all_surahs().len(), 114);
    }

    #[test]
    fn dataset_has_6236_ayahs_total() {
        let total: usize = all_surahs().iter().map(|s| s.ayahs.len()).sum();
        assert_eq!(total, 6236);
    }

    #[test]
    fn al_fatihah_has_7_ayahs_and_bismillah() {
        let f = get_surah(1).expect("surah 1 must exist");
        assert_eq!(f.ayah_count, 7);
        assert_eq!(f.ayahs.len(), 7);
        assert!(!f.ayahs[0].arabic.is_empty());
    }

    #[test]
    fn every_ayah_has_arabic_and_translations() {
        assert!(!all_surahs().is_empty());
        for s in all_surahs() {
            assert_eq!(
                s.ayah_count,
                s.ayahs.len(),
                "surah {} ayah_count mismatch",
                s.id
            );
            for a in &s.ayahs {
                assert!(
                    !a.arabic.trim().is_empty(),
                    "surah {} ayah {} arabic empty",
                    s.id,
                    a.number
                );
                assert!(
                    !a.sahih.trim().is_empty(),
                    "surah {} ayah {} sahih empty",
                    s.id,
                    a.number
                );
                assert!(
                    !a.clear.trim().is_empty(),
                    "surah {} ayah {} clear empty",
                    s.id,
                    a.number
                );
                assert!(
                    !a.kemenag.trim().is_empty(),
                    "surah {} ayah {} kemenag empty",
                    s.id,
                    a.number
                );
            }
        }
    }

    #[test]
    fn surah_ids_unique_and_ordered() {
        let ids: Vec<u8> = all_surahs().iter().map(|s| s.id).collect();
        assert_eq!(ids.len(), 114);
        for (i, id) in ids.iter().enumerate() {
            assert_eq!(*id, (i + 1) as u8);
        }
    }

    #[test]
    fn all_surahs_have_names_and_type() {
        assert!(!all_surahs().is_empty());
        for s in all_surahs() {
            assert!(!s.name_ar.trim().is_empty());
            assert!(!s.name_transliteration.trim().is_empty());
            assert!(!s.name_id.trim().is_empty());
            assert!(!s.name_en.trim().is_empty());
            assert!(s.revelation_type == "Meccan" || s.revelation_type == "Medinan");
        }
    }
}
