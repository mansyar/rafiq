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
}
