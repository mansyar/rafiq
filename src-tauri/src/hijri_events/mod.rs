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

use chrono::{Datelike, NaiveDate};
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

/// An upcoming observance occurrence resolved to its Gregorian date.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct UpcomingEvent {
    pub id: String,
    pub hijri_year: i32,
    /// Occurrence date, formatted `YYYY-MM-DD`.
    pub gregorian_date: String,
    /// True when the occurrence is `today` itself.
    pub is_today: bool,
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

/// Internal matcher: the observance for a civil date plus its computed
/// Hijri date (single engine conversion).
fn match_for_date(date: NaiveDate) -> Option<(&'static HijriEventDef, crate::hijri::HijriDate)> {
    let h =
        crate::hijri::gregorian_to_hijri(date.year(), date.month() as u8, date.day() as u8).ok()?;
    let def = all_event_defs()
        .iter()
        .find(|e| e.hijri_month == h.month && e.hijri_day == h.day)?;
    Some((def, h))
}

/// The observance matching a civil Gregorian date, if any.
///
/// Pure: converts via the Umm al-Qura engine and compares the resulting
/// Hijri month/day against bundled definitions.
pub fn event_def_for_date(date: NaiveDate) -> Option<&'static HijriEventDef> {
    match_for_date(date).map(|(def, _)| def)
}

/// The next `limit` upcoming observances from `today` (inclusive), oldest
/// first, at most one occurrence per observance. The forward search is
/// bounded to ~370 days — every observance recurs within one Hijri year
/// (~355 days) — so it always terminates.
pub fn upcoming_events(today: NaiveDate, limit: usize) -> Vec<UpcomingEvent> {
    let mut out: Vec<UpcomingEvent> = Vec::with_capacity(limit);
    if limit == 0 {
        return out;
    }
    for offset in 0..370i64 {
        let day = today + chrono::TimeDelta::try_days(offset).expect("offset is in range");
        let Some((def, h)) = match_for_date(day) else {
            continue;
        };
        if out.iter().any(|u| u.id == def.id) {
            continue;
        }
        out.push(UpcomingEvent {
            id: def.id.clone(),
            hijri_year: h.year,
            gregorian_date: day.format("%Y-%m-%d").to_string(),
            is_today: offset == 0,
        });
        if out.len() == limit {
            break;
        }
    }
    out
}

/// Daily content with an observance override attached on event days.
///
/// On non-event days this is exactly `daily::daily_content_for_date` —
/// rotation output is untouched (spec AC-4).
pub fn daily_content_with_event(
    date: NaiveDate,
    translation: crate::quran::QuranTranslation,
) -> Result<crate::daily::DailyContent, String> {
    let mut content = crate::daily::daily_content_for_date(date, translation)?;
    if let Some((def, _)) = match_for_date(date) {
        content.event = Some(build_override(&def.id, translation)?);
    }
    Ok(content)
}

/// Resolve the bundled thematic pair for an observance into frontend-ready
/// payloads (ayah text resolved against bundled Quran — no duplication).
fn build_override(
    event_id: &str,
    translation: crate::quran::QuranTranslation,
) -> Result<crate::daily::EventOverride, String> {
    let entry = all_event_content()
        .iter()
        .find(|c| c.event_id == event_id)
        .ok_or_else(|| format!("no override content defined for event '{event_id}'"))?;
    Ok(crate::daily::EventOverride {
        event_id: event_id.to_string(),
        ayah: crate::daily::resolve_ayah(&entry.ayah, translation)?,
        hadith: crate::daily::DailyHadith {
            id: entry.hadith.id.clone(),
            arabic: entry.hadith.arabic.clone(),
            en: entry.hadith.en.clone(),
            id_translation: entry.hadith.id_translation.clone(),
            source: entry.hadith.source.clone(),
        },
    })
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

    // --- Resolution logic (Phase 2 — Red phase) ---

    fn ymd(y: i32, m: u8, d: u8) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m as u32, d as u32).unwrap()
    }

    fn g2s(g: crate::hijri::GregorianDate) -> String {
        format!("{}-{:02}-{:02}", g.year, g.month, g.day)
    }

    #[test]
    fn anchor_islamic_new_year_2026_06_16() {
        let ev = event_def_for_date(ymd(2026, 6, 16));
        assert!(
            ev.is_some(),
            "2026-06-16 (1 Muharram 1448) must resolve to an event"
        );
        assert_eq!(ev.unwrap().id, "islamic_new_year");
    }

    #[test]
    fn ordinary_day_has_no_event() {
        // A known ordinary day right after the anchor.
        assert!(event_def_for_date(ymd(2026, 6, 18)).is_none());
    }

    #[test]
    fn every_event_resolves_across_two_hijri_years() {
        assert!(!all_event_defs().is_empty(), "no event defs loaded");
        for year in [1447i32, 1448] {
            for def in all_event_defs() {
                let g = crate::hijri::hijri_to_gregorian(year, def.hijri_month, def.hijri_day)
                    .unwrap_or_else(|e| panic!("{} in {year}: {e}", def.id));
                let matched = event_def_for_date(ymd(g.year, g.month, g.day))
                    .unwrap_or_else(|| panic!("event {} did not resolve in {year}", def.id));
                assert_eq!(matched.id, def.id, "wrong event matched in {year}");
            }
        }
    }

    #[test]
    fn upcoming_leads_with_today_on_event_day() {
        let up = upcoming_events(ymd(2026, 6, 16), 3);
        assert!(!up.is_empty(), "upcoming_events returned nothing");
        assert_eq!(up[0].id, "islamic_new_year");
        assert!(up[0].is_today, "today's event must be flagged");
        assert_eq!(up[0].gregorian_date, "2026-06-16");
        assert_eq!(up[0].hijri_year, 1448);
    }

    #[test]
    fn upcoming_from_ordinary_day_starts_with_next_event() {
        let up = upcoming_events(ymd(2026, 6, 17), 3);
        assert_eq!(up.len(), 3);
        assert_eq!(up[0].id, "ashura", "next after 3 Muharram is Ashura");
        assert!(!up[0].is_today);
        let expected = crate::hijri::hijri_to_gregorian(1448, 1, 10).unwrap();
        assert_eq!(up[0].gregorian_date, g2s(expected));
    }

    #[test]
    fn upcoming_crosses_hijri_year_boundary() {
        // The day after Eid al-Adha 1448: nothing remains in Hijri 1448,
        // so the next observance must roll into the NEXT Hijri year.
        let after_eid = crate::hijri::hijri_to_gregorian(1448, 12, 11).unwrap();
        let today =
            NaiveDate::from_ymd_opt(after_eid.year, after_eid.month as u32, after_eid.day as u32)
                .unwrap();
        let up = upcoming_events(today, 1);
        assert_eq!(up.len(), 1);
        assert_eq!(up[0].id, "islamic_new_year");
        assert_eq!(up[0].hijri_year, 1449);
        assert!(!up[0].is_today);
        let expected = crate::hijri::hijri_to_gregorian(1449, 1, 1).unwrap();
        assert_eq!(up[0].gregorian_date, g2s(expected));
    }

    #[test]
    fn upcoming_respects_limit_and_chronology() {
        let up = upcoming_events(ymd(2026, 6, 17), 3);
        assert_eq!(up.len(), 3, "limit must be honored");
        let mut ids = HashSet::new();
        let mut prev: Option<NaiveDate> = None;
        for e in &up {
            assert!(ids.insert(e.id.as_str()), "duplicate event in upcoming");
            let d = NaiveDate::parse_from_str(&e.gregorian_date, "%Y-%m-%d")
                .expect("gregorian_date must be YYYY-MM-DD");
            if let Some(p) = prev {
                assert!(d > p, "upcoming events must be chronological");
            }
            prev = Some(d);
        }
        assert!(upcoming_events(ymd(2026, 6, 17), 0).is_empty());
    }

    #[test]
    fn override_attaches_on_event_day_only_and_keeps_rotation() {
        // Event day: override present with fully resolved content.
        let event_day =
            daily_content_with_event(ymd(2026, 6, 16), crate::quran::QuranTranslation::Sahih)
                .expect("content must resolve");
        let ev = event_day
            .event
            .as_ref()
            .expect("override must attach on islamic_new_year");
        assert_eq!(ev.event_id, "islamic_new_year");
        assert!(
            !ev.ayah.arabic.trim().is_empty(),
            "override ayah must be resolved"
        );
        assert!(
            !ev.hadith.arabic.trim().is_empty(),
            "override hadith must be resolved"
        );

        // Adjacent ordinary day: no override, rotation unchanged (AC-4).
        let adjacent = ymd(2026, 6, 17);
        let direct =
            crate::daily::daily_content_for_date(adjacent, crate::quran::QuranTranslation::Sahih)
                .expect("direct content must resolve");
        assert!(!direct.ayah.arabic.trim().is_empty());
        let wrapped = daily_content_with_event(adjacent, crate::quran::QuranTranslation::Sahih)
            .expect("wrapped content must resolve");
        assert!(
            wrapped.event.is_none(),
            "ordinary day must not carry an override"
        );
        assert_eq!(wrapped.ayah.id, direct.ayah.id, "rotation unchanged (AC-4)");
        assert_eq!(
            wrapped.hadith.id, direct.hadith.id,
            "rotation unchanged (AC-4)"
        );

        // Serialization stays additive: omitted when None, present when Some.
        let v_plain = serde_json::to_value(&wrapped).unwrap();
        assert!(
            v_plain.get("event").is_none(),
            "absent override must be omitted from JSON"
        );
        let v_event = serde_json::to_value(&event_day).unwrap();
        assert!(
            v_event.get("event").is_some(),
            "override must serialize on event day"
        );
    }
}
