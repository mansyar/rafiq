use std::sync::OnceLock;

use chrono::NaiveDate;
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

/// Ayah payload resolved from bundled Quran for a daily item.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DailyAyah {
    pub id: String,
    pub surah_id: u8,
    pub ayah_number: u16,
    pub arabic: String,
    pub translation: String,
    pub surah_name_en: String,
    pub surah_name_ar: String,
}

/// Hadith payload for daily content (both translations exposed; frontend picks per locale).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DailyHadith {
    pub id: String,
    pub arabic: String,
    pub en: String,
    pub id_translation: String,
    pub source: String,
}

/// Thematic content override shown on an observance day (spec FR-5).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EventOverride {
    pub event_id: String,
    pub ayah: DailyAyah,
    pub hadith: DailyHadith,
}

/// Tauri command response for today's content.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DailyContent {
    /// Local date used (YYYY-MM-DD).
    pub date: String,
    pub ayah: DailyAyah,
    pub hadith: DailyHadith,
    /// Present only when the date is an Islamic observance. Additive and
    /// omitted from JSON when absent, keeping older consumers compatible.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event: Option<EventOverride>,
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

/// Epoch for deterministic rotation: 2026-01-01.
pub fn epoch() -> NaiveDate {
    NaiveDate::from_ymd_opt(2026, 1, 1).expect("epoch must be valid")
}

/// Days since epoch (can be negative for dates before 2026-01-01).
pub fn days_since_epoch(date: NaiveDate) -> i64 {
    (date - epoch()).num_days()
}

fn rotation_index(days: i64, len: usize) -> usize {
    if len == 0 {
        return 0;
    }
    let len_i64 = len as i64;
    ((days % len_i64 + len_i64) % len_i64) as usize
}

pub fn ayah_index_for_date(date: NaiveDate) -> usize {
    rotation_index(days_since_epoch(date), all_ayahs().len())
}

pub fn hadith_index_for_date(date: NaiveDate) -> usize {
    rotation_index(days_since_epoch(date), all_hadiths().len())
}

pub(crate) fn resolve_ayah(
    ref_: &AyahRef,
    translation: crate::quran::QuranTranslation,
) -> Result<DailyAyah, String> {
    let surah = crate::quran::get_surah(ref_.surah_id).ok_or_else(|| {
        format!(
            "invalid curated ayah: surah {} not found for {}",
            ref_.surah_id, ref_.id
        )
    })?;
    let ayah = surah
        .ayahs
        .iter()
        .find(|a| a.number == ref_.ayah_number)
        .ok_or_else(|| {
            format!(
                "invalid curated ayah: {}:{} not found in surah {}",
                ref_.surah_id, ref_.ayah_number, ref_.id
            )
        })?;
    let translation_text = match translation {
        crate::quran::QuranTranslation::Sahih => &ayah.sahih,
        crate::quran::QuranTranslation::Clear => &ayah.clear,
        crate::quran::QuranTranslation::Kemenag => &ayah.kemenag,
    };
    Ok(DailyAyah {
        id: ref_.id.clone(),
        surah_id: ref_.surah_id,
        ayah_number: ref_.ayah_number,
        arabic: ayah.arabic.clone(),
        translation: translation_text.clone(),
        surah_name_en: surah.name_en.clone(),
        surah_name_ar: surah.name_ar.clone(),
    })
}

pub fn daily_ayah_for_date_with_translation(
    date: NaiveDate,
    translation: crate::quran::QuranTranslation,
) -> Result<DailyAyah, String> {
    let idx = ayah_index_for_date(date);
    let r = all_ayahs()
        .get(idx)
        .ok_or_else(|| format!("no curated ayah at index {idx}"))?;
    resolve_ayah(r, translation)
}

pub fn daily_ayah_for_date(date: NaiveDate) -> Result<DailyAyah, String> {
    // Default translation fallback for pure helper without DB setting
    daily_ayah_for_date_with_translation(date, crate::quran::QuranTranslation::default())
}

pub fn daily_hadith_for_date(date: NaiveDate) -> DailyHadith {
    let idx = hadith_index_for_date(date);
    // Hadiths are guaranteed 40 items; fall back to first entry if empty (defensive)
    let h = all_hadiths().get(idx).unwrap_or_else(|| &all_hadiths()[0]);
    DailyHadith {
        id: h.id.clone(),
        arabic: h.arabic.clone(),
        en: h.en.clone(),
        id_translation: h.id_translation.clone(),
        source: h.source.clone(),
    }
}

pub fn daily_content_for_date(
    date: NaiveDate,
    translation: crate::quran::QuranTranslation,
) -> Result<DailyContent, String> {
    Ok(DailyContent {
        date: date.format("%Y-%m-%d").to_string(),
        ayah: daily_ayah_for_date_with_translation(date, translation)?,
        hadith: daily_hadith_for_date(date),
        // Rotation stays untouched here; the hijri_events wrapper attaches
        // overrides so normal-day output is unchanged (spec AC-4).
        event: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
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

    // --- Rotation engine tests (Red phase: many will fail with stub) ---

    fn ymd(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    #[test]
    fn same_date_same_content() {
        let date = ymd(2026, 3, 15);
        let ayah1 = daily_ayah_for_date(date).expect("curated ayah should resolve");
        let ayah2 = daily_ayah_for_date(date).expect("curated ayah should resolve");
        let hadith1 = daily_hadith_for_date(date);
        let hadith2 = daily_hadith_for_date(date);
        assert_eq!(ayah1, ayah2, "same date must yield same ayah");
        assert_eq!(hadith1, hadith2, "same date must yield same hadith");
    }

    #[test]
    fn adjacent_dates_advance_index() {
        let d0 = ymd(2026, 1, 1);
        let d1 = ymd(2026, 1, 2);
        let d2 = ymd(2026, 1, 3);
        // Adjacent dates should move forward by 1 mod len
        let idx0 = ayah_index_for_date(d0);
        let idx1 = ayah_index_for_date(d1);
        let idx2 = ayah_index_for_date(d2);
        assert_eq!(idx1, (idx0 + 1) % all_ayahs().len());
        assert_eq!(idx2, (idx1 + 1) % all_ayahs().len());
        let h0 = hadith_index_for_date(d0);
        let h1 = hadith_index_for_date(d1);
        let h2 = hadith_index_for_date(d2);
        assert_eq!(h1, (h0 + 1) % all_hadiths().len());
        assert_eq!(h2, (h1 + 1) % all_hadiths().len());
    }

    #[test]
    fn full_cycle_ayahs_covers_all_exactly_once() {
        let start = ymd(2026, 1, 1);
        let mut seen = HashSet::new();
        for offset in 0..365 {
            let date = start + chrono::TimeDelta::try_days(offset).unwrap();
            let ayah = daily_ayah_for_date(date).expect("curated ayah should resolve");
            let key = (ayah.surah_id, ayah.ayah_number);
            assert!(
                seen.insert(key),
                "duplicate ayah at offset {offset}: {:?}",
                key
            );
        }
        assert_eq!(
            seen.len(),
            365,
            "365-day cycle must cover 365 distinct ayahs"
        );
        // Next day should wrap to start
        let wrap = start + chrono::TimeDelta::try_days(365).unwrap();
        let first = daily_ayah_for_date(start).expect("curated ayah should resolve");
        let wrapped = daily_ayah_for_date(wrap).expect("curated ayah should resolve");
        assert_eq!(first, wrapped, "day 365 should wrap to start (mod 365)");
    }

    #[test]
    fn full_cycle_hadiths_covers_all_exactly_once() {
        let start = ymd(2026, 1, 1);
        let mut seen = HashSet::new();
        for offset in 0..40 {
            let date = start + chrono::TimeDelta::try_days(offset).unwrap();
            let h = daily_hadith_for_date(date);
            assert!(
                seen.insert(h.id.clone()),
                "duplicate hadith at offset {offset}: {}",
                h.id
            );
        }
        assert_eq!(
            seen.len(),
            40,
            "40-day cycle must cover 40 distinct hadiths"
        );
        let wrap = start + chrono::TimeDelta::try_days(40).unwrap();
        let first = daily_hadith_for_date(start);
        let wrapped = daily_hadith_for_date(wrap);
        assert_eq!(first, wrapped, "day 40 should wrap to start (mod 40)");
    }

    #[test]
    fn epoch_boundary() {
        let epoch = ymd(2026, 1, 1);
        assert_eq!(days_since_epoch(epoch), 0);
        assert_eq!(ayah_index_for_date(epoch), 0);
        assert_eq!(hadith_index_for_date(epoch), 0);
        let before = ymd(2025, 12, 31);
        assert_eq!(days_since_epoch(before), -1);
        // Before epoch should wrap to last item
        assert_eq!(
            ayah_index_for_date(before),
            all_ayahs().len() - 1,
            "2025-12-31 should map to last ayah (wrap)"
        );
        assert_eq!(
            hadith_index_for_date(before),
            all_hadiths().len() - 1,
            "2025-12-31 should map to last hadith (wrap)"
        );
    }

    #[test]
    fn leap_year_and_feb_boundary() {
        // 2028 is a leap year
        let feb28 = ymd(2028, 2, 28);
        let feb29 = ymd(2028, 2, 29);
        let mar01 = ymd(2028, 3, 1);
        let idx28 = ayah_index_for_date(feb28);
        let idx29 = ayah_index_for_date(feb29);
        let idx01 = ayah_index_for_date(mar01);
        assert_eq!(idx29, (idx28 + 1) % all_ayahs().len());
        assert_eq!(idx01, (idx29 + 1) % all_ayahs().len());
        // Verify days_since_epoch accounts for leap day
        assert_eq!(days_since_epoch(feb29) - days_since_epoch(feb28), 1);
        assert_eq!(days_since_epoch(mar01) - days_since_epoch(feb29), 1);
        // Non-leap Feb 2027
        let f28_27 = ymd(2027, 2, 28);
        let m01_27 = ymd(2027, 3, 1);
        assert_eq!(
            days_since_epoch(m01_27) - days_since_epoch(f28_27),
            1,
            "non-leap Feb should advance 1 day to Mar 1"
        );
    }

    #[test]
    fn daily_content_response_shape_resolves_arabic_and_translation() {
        let date = ymd(2026, 1, 1);
        let content = daily_content_for_date(date, crate::quran::QuranTranslation::Sahih)
            .expect("should resolve");
        assert_eq!(content.date, "2026-01-01");
        // ayah Arabic resolved, not empty (stub currently empty -> will fail)
        assert!(
            !content.ayah.arabic.trim().is_empty(),
            "ayah arabic must be resolved from bundled Quran"
        );
        assert!(
            !content.ayah.translation.trim().is_empty(),
            "ayah translation must be resolved"
        );
        assert!(
            !content.ayah.surah_name_en.trim().is_empty(),
            "surah_name_en must be populated"
        );
        // hadith fields non-empty
        assert!(!content.hadith.arabic.trim().is_empty());
        assert!(!content.hadith.en.trim().is_empty());
        assert!(!content.hadith.id_translation.trim().is_empty());
        assert!(!content.hadith.source.trim().is_empty());
    }

    #[test]
    fn translation_follows_setting_variants() {
        let date = ymd(2026, 6, 15);
        let sahih = daily_content_for_date(date, crate::quran::QuranTranslation::Sahih)
            .expect("should resolve");
        let clear = daily_content_for_date(date, crate::quran::QuranTranslation::Clear)
            .expect("should resolve");
        let kemenag = daily_content_for_date(date, crate::quran::QuranTranslation::Kemenag)
            .expect("should resolve");
        // Same ayah, different translations should differ (at least one differs)
        // Stub will fail because all translations empty and equal
        assert_ne!(sahih.ayah.surah_id, 0, "surah_id must be valid");
        // Most ayahs have differing translations among the three; assert they are not all identical
        let all_same = sahih.ayah.translation == clear.ayah.translation
            && clear.ayah.translation == kemenag.ayah.translation;
        assert!(
            !all_same,
            "translations should vary across Sahih/Clear/Kemenag for many ayahs; got identical"
        );
    }
}
