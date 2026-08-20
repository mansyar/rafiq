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
    // Bundled asset invariant: quran.json is generated at build-time (4.9 MB, 114/6236).
    // Parse failure is a build-time defect → panic is intentional to surface early.
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

pub const QURAN_TRANSLATION_KEY: &str = "quran_translation";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum QuranTranslation {
    #[default]
    Sahih,
    Clear,
    Kemenag,
}

pub fn parse_quran_translation(s: &str) -> Result<QuranTranslation, String> {
    match s.trim().to_ascii_lowercase().as_str() {
        "sahih" => Ok(QuranTranslation::Sahih),
        "clear" => Ok(QuranTranslation::Clear),
        "kemenag" => Ok(QuranTranslation::Kemenag),
        _ => Err(format!("unknown quran translation: {}", s.trim())),
    }
}

pub fn list_surahs() -> Vec<Surah> {
    all_surahs().to_vec()
}

pub fn search_surahs(query: &str, limit: usize) -> Vec<Surah> {
    let q = query.trim();
    if q.is_empty() || limit == 0 {
        return Vec::new();
    }
    let q_lower = q.to_ascii_lowercase();
    let mut scored: Vec<(u8, &Surah)> = Vec::new();
    for s in all_surahs() {
        let transliteration_lower = s.name_transliteration.to_ascii_lowercase();
        let name_en_lower = s.name_en.to_ascii_lowercase();
        let name_id_lower = s.name_id.to_ascii_lowercase();
        let id_str = s.id.to_string();
        let mut score: Option<u8> = None;
        if transliteration_lower == q_lower || name_en_lower == q_lower || name_id_lower == q_lower
        {
            score = Some(0);
        } else if transliteration_lower.starts_with(&q_lower)
            || name_en_lower.starts_with(&q_lower)
            || name_id_lower.starts_with(&q_lower)
        {
            score = Some(1);
        } else if transliteration_lower.contains(&q_lower)
            || name_en_lower.contains(&q_lower)
            || name_id_lower.contains(&q_lower)
        {
            score = Some(2);
        } else if s.name_ar == q {
            score = Some(3);
        } else if s.name_ar.contains(q) {
            score = Some(4);
        } else if id_str == q {
            score = Some(5);
        } else if id_str.contains(q) && q.chars().all(|c| c.is_ascii_digit()) {
            score = Some(6);
        }
        if let Some(sc) = score {
            scored.push((sc, s));
        }
    }
    scored.sort_by(|a, b| {
        a.0.cmp(&b.0)
            .then_with(|| {
                a.1.name_transliteration
                    .len()
                    .cmp(&b.1.name_transliteration.len())
            })
            .then_with(|| a.1.name_transliteration.cmp(&b.1.name_transliteration))
            .then_with(|| a.1.id.cmp(&b.1.id))
    });
    scored
        .into_iter()
        .take(limit)
        .map(|(_, s)| s.clone())
        .collect()
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

    // Red — Task 2.1 search + translation + list
    #[test]
    fn list_surahs_returns_114_in_order() {
        let list = list_surahs();
        assert_eq!(list.len(), 114);
        assert_eq!(list[0].id, 1);
        assert_eq!(list[113].id, 114);
    }

    #[test]
    fn get_surah_returns_valid_and_none_for_invalid() {
        assert!(get_surah(1).is_some());
        assert!(get_surah(114).is_some());
        assert!(get_surah(0).is_none());
        assert!(get_surah(115).is_none());
    }

    #[test]
    fn search_returns_baqara_for_baqara_query() {
        let r = search_surahs("baqara", 5);
        assert!(!r.is_empty());
        assert!(r.iter().any(|s| s.id == 2));
    }

    #[test]
    fn search_is_case_insensitive() {
        let a = search_surahs("Al-Faatiha", 5);
        let b = search_surahs("AL-FAATIHA", 5);
        assert_eq!(a.len(), b.len());
        assert!(!a.is_empty());
    }

    #[test]
    fn search_by_number_substring() {
        let r = search_surahs("2", 10);
        assert!(r.iter().any(|s| s.id == 2));
    }

    #[test]
    fn search_by_arabic_substring() {
        let r = search_surahs("البَقَر", 5);
        assert!(!r.is_empty());
        assert!(r.iter().any(|s| s.id == 2));
    }

    #[test]
    fn search_empty_returns_empty() {
        assert!(search_surahs("", 5).is_empty());
        assert!(search_surahs("   ", 5).is_empty());
    }

    #[test]
    fn search_not_found_returns_empty() {
        assert!(search_surahs("xyznotfound999", 5).is_empty());
    }

    #[test]
    fn search_respects_limit() {
        let r = search_surahs("a", 3);
        assert!(r.len() <= 3);
        let r2 = search_surahs("a", 1);
        assert_eq!(r2.len(), 1);
    }

    #[test]
    fn search_ranking_prefix_first() {
        let r = search_surahs("al-faa", 5);
        assert!(!r.is_empty());
        assert_eq!(r[0].id, 1);
    }

    #[test]
    fn parse_quran_translation_valid() {
        assert_eq!(
            parse_quran_translation("sahih").unwrap(),
            QuranTranslation::Sahih
        );
        assert_eq!(
            parse_quran_translation("clear").unwrap(),
            QuranTranslation::Clear
        );
        assert_eq!(
            parse_quran_translation("kemenag").unwrap(),
            QuranTranslation::Kemenag
        );
    }

    #[test]
    fn parse_quran_translation_invalid() {
        assert!(parse_quran_translation("invalid").is_err());
        assert!(parse_quran_translation("").is_err());
    }
}
