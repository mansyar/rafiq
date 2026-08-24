//! Tray & background-presence support: pure formatting/policy logic plus the
//! OS tray runtime wiring. Pure functions are unit-tested here; the runtime
//! integration lives in [`runtime`] behind cfg(not(test)) where practical.

use chrono::{DateTime, FixedOffset, Utc};

/// Capitalized display name for a lowercase prayer key (e.g. "asr" → "Asr").
fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

/// Format the disabled info-row text for the next upcoming prayer,
/// e.g. prefix="Next:", prayer="asr" → `"Next: Asr · 16:12"` rendered in the
/// user's local offset. FR-3 / AC-3.
pub fn countdown_row(
    prefix: &str,
    prayer: &str,
    instant: DateTime<Utc>,
    offset: FixedOffset,
) -> String {
    let local = instant.with_timezone(&offset);
    format!(
        "{} {} \u{b7} {}",
        prefix.trim_end(),
        capitalize(prayer),
        local.format("%H:%M")
    )
}

/// Localized strings handed over from the frontend i18n catalog (NFR-1).
pub struct TrayLabels {
    /// Countdown prefix, e.g. `"Next:"` / `"Berikutnya:"`.
    pub next_prefix: String,
    /// Placeholder shown before location/method setup completes.
    pub complete_setup: String,
    /// Menu action label for restoring the window.
    pub show: String,
    /// Menu action label for exiting the app.
    pub quit: String,
}

/// Identifies a clickable tray menu entry.
#[derive(Debug, PartialEq, Eq)]
pub enum TrayAction {
    Show,
    Quit,
}

/// One row of the tray context menu (FR-3).
#[derive(Debug, PartialEq, Eq)]
pub enum TrayMenuItem {
    /// Disabled informational row (next-prayer countdown or placeholder).
    Info { text: String },
    /// Clickable action row.
    Action { action: TrayAction, text: String },
}

/// Build the ordered tray menu model: disabled info row, then Show, then
/// Quit. `None` renders the setup placeholder instead of a countdown.
pub fn build_tray_menu(
    labels: &TrayLabels,
    next: Option<(&str, DateTime<Utc>)>,
    offset: FixedOffset,
) -> Vec<TrayMenuItem> {
    let info = match next {
        Some((prayer, instant)) => TrayMenuItem::Info {
            text: countdown_row(&labels.next_prefix, prayer, instant, offset),
        },
        None => TrayMenuItem::Info {
            text: labels.complete_setup.clone(),
        },
    };
    vec![
        info,
        TrayMenuItem::Action {
            action: TrayAction::Show,
            text: labels.show.clone(),
        },
        TrayMenuItem::Action {
            action: TrayAction::Quit,
            text: labels.quit.clone(),
        },
    ]
}

/// Settings key persisting whether the one-time hide-to-tray explainer has
/// been shown (FR-2 / AC-2). Value "1" once shown.
pub const TRAY_HINT_SHOWN_KEY: &str = "tray_hint_shown";

/// Decide whether the one-time hide-to-tray explainer notification should be
/// shown, based on the persisted setting value. Only an affirmative stored
/// value ("1"/"true"/"enabled") suppresses it — anything else (missing,
/// empty, falsy, corrupt) shows the hint exactly once more.
pub fn should_show_tray_hint(stored: Option<&str>) -> bool {
    !matches!(stored, Some(v) if matches!(v.trim(), "1" | "true" | "enabled"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utc(s: &str) -> DateTime<Utc> {
        s.parse::<DateTime<Utc>>().unwrap()
    }

    fn offset_hours(h: i32) -> FixedOffset {
        FixedOffset::east_opt(h * 3600).unwrap()
    }

    // ── countdown_row ───────────────────────────────────────────────────────

    #[test]
    fn countdown_formats_capitalized_name_and_utc_time_at_gmt() {
        let got = countdown_row("Next:", "asr", utc("2025-08-20T09:30:00Z"), offset_hours(0));
        assert_eq!(got, "Next: Asr \u{b7} 09:30");
    }

    #[test]
    fn countdown_converts_instant_to_local_offset() {
        let got = countdown_row(
            "Next:",
            "isha",
            utc("2025-08-20T09:30:00Z"),
            offset_hours(7),
        );
        assert_eq!(got, "Next: Isha \u{b7} 16:30");
    }

    #[test]
    fn countdown_survives_midnight_rollover_across_day_boundary() {
        // Tomorrow's Fajr seen from late evening local time — date must not leak
        // into the label, only HH:MM of the (next-day) local time.
        let got = countdown_row(
            "Next:",
            "fajr",
            utc("2025-08-21T02:00:00Z"),
            offset_hours(3),
        );
        assert_eq!(got, "Next: Fajr \u{b7} 05:00");
    }

    #[test]
    fn countdown_uses_localized_prefix_verbatim() {
        let got = countdown_row(
            "Berikutnya:",
            "maghrib",
            utc("2025-08-20T12:10:00Z"),
            offset_hours(0),
        );
        assert_eq!(got, "Berikutnya: Maghrib \u{b7} 12:10");
    }

    // ── build_tray_menu ─────────────────────────────────────────────────────

    fn labels() -> TrayLabels {
        TrayLabels {
            next_prefix: "Next:".into(),
            complete_setup: "Complete setup in Rafiq".into(),
            show: "Show Rafiq".into(),
            quit: "Quit Rafiq".into(),
        }
    }

    #[test]
    fn menu_with_next_prayer_is_info_then_show_then_quit() {
        let got = build_tray_menu(
            &labels(),
            Some(("asr", utc("2025-08-20T09:30:00Z"))),
            offset_hours(0),
        );
        assert_eq!(
            got,
            vec![
                TrayMenuItem::Info {
                    text: "Next: Asr \u{b7} 09:30".into()
                },
                TrayMenuItem::Action {
                    action: TrayAction::Show,
                    text: "Show Rafiq".into()
                },
                TrayMenuItem::Action {
                    action: TrayAction::Quit,
                    text: "Quit Rafiq".into()
                },
            ]
        );
    }

    #[test]
    fn menu_without_location_shows_complete_setup_placeholder() {
        let got = build_tray_menu(&labels(), None, offset_hours(0));
        assert_eq!(
            got[0],
            TrayMenuItem::Info {
                text: "Complete setup in Rafiq".into()
            }
        );
    }

    #[test]
    fn menu_always_keeps_show_and_quit_after_the_info_row() {
        for next in [None, Some(("isha", utc("2025-08-20T09:30:00Z")))] {
            let got = build_tray_menu(&labels(), next, offset_hours(0));
            assert_eq!(got.len(), 3);
            assert!(matches!(&got[0], TrayMenuItem::Info { .. }));
            assert_eq!(
                got[1],
                TrayMenuItem::Action {
                    action: TrayAction::Show,
                    text: "Show Rafiq".into()
                }
            );
            assert_eq!(
                got[2],
                TrayMenuItem::Action {
                    action: TrayAction::Quit,
                    text: "Quit Rafiq".into()
                }
            );
        }
    }

    // ── should_show_tray_hint ───────────────────────────────────────────────

    #[test]
    fn hint_shows_when_setting_is_missing() {
        assert!(should_show_tray_hint(None));
    }

    #[test]
    fn hint_shows_for_empty_or_falsy_values() {
        assert!(should_show_tray_hint(Some("")));
        assert!(should_show_tray_hint(Some("0")));
        assert!(should_show_tray_hint(Some("false")));
        assert!(should_show_tray_hint(Some("garbage")));
    }

    #[test]
    fn hint_suppressed_only_after_affirmative_stored_value() {
        assert!(!should_show_tray_hint(Some("1")));
        assert!(!should_show_tray_hint(Some("true")));
        assert!(!should_show_tray_hint(Some("enabled")));
    }
}
