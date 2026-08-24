//! Hijri event observances — bundled data assets for the "Hijri Events +
//! Special Dates" track.
//!
//! Assets (offline-first, no display strings here — names/descriptions live in
//! the frontend i18n catalog):
//! - `src-tauri/assets/hijri-events/events.json` — observance date definitions
//!   keyed to Umm al-Qura civil Hijri dates.
//! - `src-tauri/assets/hijri-events/content.json` — per-event thematic Daily
//!   Reflection override pair (ayah reference into bundled Quran + hadith).
//!
//! Loader pattern mirrors `daily::` (`include_str!` + `OnceLock`).

use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

// Reuse the exact shapes already established for curated content.
pub use crate::daily::{AyahRef, Hadith};

/// Observance date definition from `events.json`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HijriEventDef {
    pub id: String,
    pub hijri_month: u8,
    pub hijri_day: u8,
    pub estimated: bool,
}

/// Per-event thematic override pair from `content.json`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EventContent {
    pub event_id: String,
    pub ayah: AyahRef,
    pub hadith: Hadith,
}

// Bundled assets — validated by tests in this module.
static EVENTS_JSON: &str = include_str!("../../assets/hijri-events/events.json");
static CONTENT_JSON: &str = include_str!("../../assets/hijri-events/content.json");

static EVENT_DEFS: OnceLock<Vec<HijriEventDef>> = OnceLock::new();
static EVENT_CONTENT: OnceLock<Vec<EventContent>> = OnceLock::new();

fn load_event_defs_inner() -> Vec<HijriEventDef> {
    serde_json::from_str(EVENTS_JSON)
        .expect("events.json must be valid JSON array of HijriEventDef")
}

fn load_event_content_inner() -> Vec<EventContent> {
    serde_json::from_str(CONTENT_JSON)
        .expect("content.json must be valid JSON array of EventContent")
}

pub fn all_event_defs() -> &'static [HijriEventDef] {
    EVENT_DEFS.get_or_init(load_event_defs_inner)
}

pub fn all_event_content() -> &'static [EventContent] {
    EVENT_CONTENT.get_or_init(load_event_content_inner)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    const EXPECTED_EVENT_IDS: [&str; 8] = [
        "islamic_new_year",
        "ashura",
        "mawlid_an_nabi",
        "ramadan_begins",
        "laylat_al_qadr",
        "eid_al_fitr",
        "arafah",
        "eid_al_adha",
    ];

    #[test]
    fn events_exactly_8() {
        assert_eq!(
            all_event_defs().len(),
            8,
            "events.json must contain exactly 8 observances"
        );
    }

    #[test]
    fn events_unique_ids() {
        assert!(!all_event_defs().is_empty(), "no event defs loaded");
        let mut seen = HashSet::new();
        for e in all_event_defs() {
            assert!(seen.insert(&e.id), "duplicate event id: {}", e.id);
        }
    }

    #[test]
    fn events_expected_ids_present() {
        let actual: HashSet<&str> = all_event_defs().iter().map(|e| e.id.as_str()).collect();
        let expected: HashSet<&str> = EXPECTED_EVENT_IDS.into_iter().collect();
        assert_eq!(
            actual, expected,
            "event ids must match the approved core set"
        );
    }

    #[test]
    fn events_hijri_month_in_range() {
        assert!(!all_event_defs().is_empty(), "no event defs loaded");
        for e in all_event_defs() {
            assert!(
                (1..=12).contains(&e.hijri_month),
                "{} has invalid hijri_month {}",
                e.id,
                e.hijri_month
            );
        }
    }

    #[test]
    fn events_hijri_day_in_range() {
        assert!(!all_event_defs().is_empty(), "no event defs loaded");
        for e in all_event_defs() {
            assert!(
                (1..=30).contains(&e.hijri_day),
                "{} has invalid hijri_day {}",
                e.id,
                e.hijri_day
            );
        }
    }

    #[test]
    fn only_laylat_al_qadr_is_estimated() {
        assert!(
            all_event_defs().iter().any(|e| e.id == "laylat_al_qadr"),
            "laylat_al_qadr must be defined"
        );
        for e in all_event_defs() {
            if e.id == "laylat_al_qadr" {
                assert!(e.estimated, "laylat_al_qadr must be estimated");
            } else {
                assert!(
                    !e.estimated,
                    "only laylat_al_qadr may carry estimated=true, found on {}",
                    e.id
                );
            }
        }
    }

    #[test]
    fn content_covers_every_event_exactly_once() {
        let defs = all_event_defs();
        let content = all_event_content();
        assert!(!defs.is_empty(), "no event defs loaded");
        assert_eq!(
            content.len(),
            defs.len(),
            "content.json must have one entry per event"
        );
        let mut def_ids: HashSet<&str> = defs.iter().map(|d| d.id.as_str()).collect();
        for c in content {
            assert!(
                def_ids.remove(c.event_id.as_str()),
                "content entry '{}' does not match a defined event (orphan or duplicate)",
                c.event_id
            );
        }
        assert!(def_ids.is_empty(), "events without content: {:?}", def_ids);
    }

    #[test]
    fn content_ids_unique_across_entries() {
        assert!(!all_event_content().is_empty(), "no event content loaded");
        let mut ayah_ids = HashSet::new();
        let mut hadith_ids = HashSet::new();
        for c in all_event_content() {
            assert!(
                ayah_ids.insert(&c.ayah.id),
                "duplicate ayah id: {}",
                c.ayah.id
            );
            assert!(
                hadith_ids.insert(&c.hadith.id),
                "duplicate hadith id: {}",
                c.hadith.id
            );
        }
    }

    #[test]
    fn content_hadith_fields_non_empty() {
        assert!(!all_event_content().is_empty(), "no event content loaded");
        for c in all_event_content() {
            let h = &c.hadith;
            assert!(!h.id.trim().is_empty(), "empty id for {}", c.event_id);
            assert!(
                !h.arabic.trim().is_empty(),
                "empty arabic for {}",
                c.event_id
            );
            assert!(!h.en.trim().is_empty(), "empty en for {}", c.event_id);
            assert!(
                !h.id_translation.trim().is_empty(),
                "empty id_translation for {}",
                c.event_id
            );
            assert!(
                !h.source.trim().is_empty(),
                "empty source for {}",
                c.event_id
            );
        }
    }

    #[test]
    fn content_ayah_refs_resolve_against_quran() {
        // No duplicated Quran text: entries are references only, so every ref
        // must resolve against the bundled Tanzil Quran data.
        assert!(!all_event_content().is_empty(), "no event content loaded");
        for c in all_event_content() {
            let global = crate::quran::global_ayah(c.ayah.surah_id, c.ayah.ayah_number);
            assert!(
                global.is_some(),
                "ayah {} ({}:{}) for event {} does not resolve against bundled Quran",
                c.ayah.id,
                c.ayah.surah_id,
                c.ayah.ayah_number,
                c.event_id
            );
        }
    }
}
