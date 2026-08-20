use chrono::{DateTime, Utc};
use tauri::{Emitter, Manager};

use crate::prayer::PrayerTimes;

fn parse(s: &str) -> Option<DateTime<Utc>> {
    s.parse::<DateTime<Utc>>().ok()
}

/// Returns the next upcoming prayer (among the 5 daily prayers, sunrise excluded)
/// after `now` for the given `times`. Returns `None` if all prayers for the day
/// have passed. The caller may then compute tomorrow's times to find the next Fajr.
pub fn next_prayer(times: &PrayerTimes, now: DateTime<Utc>) -> Option<(String, DateTime<Utc>)> {
    let candidates = [
        ("fajr", &times.fajr),
        ("dhuhr", &times.dhuhr),
        ("asr", &times.asr),
        ("maghrib", &times.maghrib),
        ("isha", &times.isha),
    ];
    let mut best: Option<(String, DateTime<Utc>)> = None;
    for (name, s) in candidates {
        if let Some(dt) = parse(s) {
            if dt > now {
                match &best {
                    None => best = Some((name.to_string(), dt)),
                    Some((_, best_dt)) if dt < *best_dt => best = Some((name.to_string(), dt)),
                    _ => {}
                }
            }
        }
    }
    best
}

/// Whether the scheduler should emit *any* signal (notification or adhan).
/// Per spec FR-4.3 / FR-5.3 toggles are independent: a trigger should fire
/// when *either* notification or adhan is enabled (fire_prayer checks each
/// toggle independently to decide which channel to emit).
pub fn should_fire(notification_enabled: bool, adhan_enabled: bool) -> bool {
    notification_enabled || adhan_enabled
}

/// Given today's and tomorrow's prayer times, returns the next prayer instant.
/// If today's next is Some, returns it; otherwise returns tomorrow's Fajr.
pub fn next_prayer_including_tomorrow(
    today: &PrayerTimes,
    tomorrow: &PrayerTimes,
    now: DateTime<Utc>,
) -> Option<(String, DateTime<Utc>)> {
    if let Some(next) = next_prayer(today, now) {
        return Some(next);
    }
    // All of today's prayers have passed — next is tomorrow's earliest upcoming
    // (which for the spec is Fajr, but we reuse next_prayer for robustness).
    if let Some(next) = next_prayer(tomorrow, now) {
        return Some(next);
    }
    // Fallback: if parsing failed or tomorrow's times are also in the past
    // (unlikely), try tomorrow's Fajr directly.
    parse(&tomorrow.fajr).map(|dt| ("fajr".to_string(), dt))
}

// ── Background scheduler (desktop) ──────────────────────────────────────────

use std::sync::mpsc::{self, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

static RESCHEDULE_SENDER: OnceLock<Mutex<Option<Sender<()>>>> = OnceLock::new();

fn reschedule_sender() -> &'static Mutex<Option<Sender<()>>> {
    RESCHEDULE_SENDER.get_or_init(|| Mutex::new(None))
}

/// Signal the background scheduler to recompute the next prayer time
/// immediately (e.g., after location/method/toggle changes).
pub fn request_reschedule() {
    if let Some(lock) = RESCHEDULE_SENDER.get() {
        if let Ok(guard) = lock.lock() {
            if let Some(sender) = guard.as_ref() {
                let _ = sender.send(());
            }
        }
    }
}

fn read_toggle(conn: &rusqlite::Connection, key: &str) -> bool {
    // Tolerant read — missing means default enabled (per prayer.ts helpers).
    match crate::commands::get_setting_impl(conn, key) {
        Ok(Some(v)) => {
            let trimmed = v.trim();
            trimmed == "1" || trimmed == "true" || trimmed == "enabled"
        }
        Ok(None) => true,
        Err(_) => true,
    }
}

/// Compute the next prayer (name + instant) for the persisted location/method.
/// Returns `Ok(None)` when no location is configured, `Err` on calculation errors.
pub fn compute_next_prayer(
    conn: &rusqlite::Connection,
    now: DateTime<Utc>,
) -> Result<Option<(String, DateTime<Utc>)>, String> {
    let resolved = crate::commands::resolve_stored_location(conn)?;
    let Some(loc) = resolved else {
        return Ok(None);
    };
    let method = crate::commands::resolve_prayer_method(conn)?;
    let coords = crate::prayer::Coordinates {
        latitude: loc.latitude,
        longitude: loc.longitude,
    };

    // Compute for today and tomorrow (UTC dates — matches prayer engine's `Date` handling).
    let today_naive = now.date_naive();
    let tomorrow_naive = today_naive + chrono::Duration::days(1);

    let today_times = crate::prayer::calculate_prayer_times(today_naive, coords, method)?;
    let tomorrow_times = crate::prayer::calculate_prayer_times(tomorrow_naive, coords, method)?;

    Ok(next_prayer_including_tomorrow(
        &today_times,
        &tomorrow_times,
        now,
    ))
}

/// Spawn a background thread that sleeps until the next prayer time,
/// then fires a desktop notification and emits a `prayer-time` event to the
/// frontend for adhan playback. The thread wakes early when
/// `request_reschedule()` is called (e.g., after settings mutations) and
/// recomputes. Runs only on native (not in `cargo test`).
pub fn spawn_scheduler(app: tauri::AppHandle) {
    // Detached background thread: intentionally never joined; process exit tears it down.
    // In `cargo test` this function is never called, so the thread does not run during tests.
    let (tx, rx) = mpsc::channel::<()>();
    if let Ok(mut guard) = reschedule_sender().lock() {
        *guard = Some(tx);
    }

    std::thread::spawn(move || {
        loop {
            let now = Utc::now();
            let next = {
                // Short-lived lock on the DB — compute_next_prayer reads settings.
                let state = app.state::<crate::commands::AppState>();
                let conn = match state.conn.lock() {
                    Ok(g) => g,
                    Err(e) => {
                        eprintln!("[scheduler] could not lock DB: {e}");
                        std::thread::sleep(Duration::from_secs(60));
                        continue;
                    }
                };
                match compute_next_prayer(&conn, now) {
                    Ok(v) => v,
                    Err(e) => {
                        eprintln!("[scheduler] compute_next_prayer failed: {e}");
                        std::thread::sleep(Duration::from_secs(60));
                        continue;
                    }
                }
            };

            let Some((prayer_name, instant)) = next else {
                // No location configured — poll every 60 s until one is set.
                // Also wait for reschedule signal (settings change).
                let _ = rx.recv_timeout(Duration::from_secs(60));
                continue;
            };

            let wait = (instant - Utc::now()).num_milliseconds();
            if wait <= 0 {
                // Instant already passed or is imminent — fire immediately,
                // but avoid tight loop by sleeping briefly after firing.
                fire_prayer(&app, &prayer_name, instant);
                std::thread::sleep(Duration::from_secs(61));
                continue;
            }

            let duration = Duration::from_millis(wait as u64);
            // Sleep until instant, but wake early on reschedule.
            match rx.recv_timeout(duration) {
                Ok(_) => {
                    // Settings changed — recompute next prayer.
                    continue;
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    // Time to fire.
                    fire_prayer(&app, &prayer_name, instant);
                    // Avoid re-firing the same instant if clock is slightly off.
                    std::thread::sleep(Duration::from_secs(61));
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    eprintln!("[scheduler] channel disconnected — exiting");
                    break;
                }
            }
        }
    });
}

fn fire_prayer(app: &tauri::AppHandle, prayer_name: &str, instant: DateTime<Utc>) {
    // Read toggles via a fresh DB lock (toggles are independent of prayer calc).
    let (notification_enabled, adhan_enabled) = {
        let state = app.state::<crate::commands::AppState>();
        let conn = match state.conn.lock() {
            Ok(g) => g,
            Err(_) => {
                // Fallback: assume enabled if we cannot read.
                return;
            }
        };
        (
            read_toggle(&conn, "notification_enabled"),
            read_toggle(&conn, "adhan_enabled"),
        )
    };

    let title = format!("Time for {}", capitalize(prayer_name));
    let body = format!(
        "{} prayer time — {}",
        capitalize(prayer_name),
        instant.format("%H:%M UTC")
    );

    if notification_enabled {
        use tauri_plugin_notification::NotificationExt;
        let res = app
            .notification()
            .builder()
            .title(title.clone())
            .body(body.clone())
            .show();
        if let Err(e) = res {
            eprintln!("[scheduler] notification failed: {e}");
        }
    }

    if adhan_enabled {
        // Emit to frontend for adhan audio playback (AdhanPlayer listens for "prayer-time").
        let payload = serde_json::json!({
            "prayer": prayer_name,
            "time": instant.to_rfc3339(),
        });
        if let Err(e) = app.emit("prayer-time", payload) {
            eprintln!("[scheduler] emit prayer-time failed: {e}");
        }
    }

    // Also emit when both disabled? No — respect toggles. If notification disabled but
    // adhan enabled, we still emit for audio; handled above.
    // If both disabled, we do nothing (but still advance to next prayer on loop).
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dt(s: &str) -> DateTime<Utc> {
        s.parse::<DateTime<Utc>>().unwrap()
    }

    fn simple_day() -> PrayerTimes {
        PrayerTimes {
            fajr: "2025-08-20T02:00:00Z".to_string(),
            sunrise: "2025-08-20T03:00:00Z".to_string(),
            dhuhr: "2025-08-20T06:00:00Z".to_string(),
            asr: "2025-08-20T09:00:00Z".to_string(),
            maghrib: "2025-08-20T12:00:00Z".to_string(),
            isha: "2025-08-20T13:00:00Z".to_string(),
        }
    }

    fn simple_tomorrow() -> PrayerTimes {
        PrayerTimes {
            fajr: "2025-08-21T02:00:00Z".to_string(),
            sunrise: "2025-08-21T03:00:00Z".to_string(),
            dhuhr: "2025-08-21T06:00:00Z".to_string(),
            asr: "2025-08-21T09:00:00Z".to_string(),
            maghrib: "2025-08-21T12:00:00Z".to_string(),
            isha: "2025-08-21T13:00:00Z".to_string(),
        }
    }

    #[test]
    fn next_prayer_before_fajr_returns_fajr() {
        let times = simple_day();
        let now = dt("2025-08-20T01:00:00Z");
        let next = next_prayer(&times, now).expect("should be Fajr");
        assert_eq!(next.0, "fajr");
        assert_eq!(next.1, dt("2025-08-20T02:00:00Z"));
    }

    #[test]
    fn next_prayer_after_fajr_skips_sunrise_and_returns_dhuhr() {
        let times = simple_day();
        let now = dt("2025-08-20T02:30:00Z");
        let next = next_prayer(&times, now).expect("should be Dhuhr");
        assert_eq!(next.0, "dhuhr");
        assert_eq!(next.1, dt("2025-08-20T06:00:00Z"));
    }

    #[test]
    fn next_prayer_between_dhuhr_and_asr_returns_asr() {
        let times = simple_day();
        let now = dt("2025-08-20T07:00:00Z");
        let next = next_prayer(&times, now).expect("should be Asr");
        assert_eq!(next.0, "asr");
    }

    #[test]
    fn next_prayer_after_isha_returns_none() {
        let times = simple_day();
        let now = dt("2025-08-20T14:00:00Z");
        assert!(next_prayer(&times, now).is_none());
    }

    #[test]
    fn next_prayer_including_tomorrow_after_isha_returns_tomorrow_fajr() {
        let today = simple_day();
        let tomorrow = simple_tomorrow();
        let now = dt("2025-08-20T14:00:00Z");
        let next = next_prayer_including_tomorrow(&today, &tomorrow, now)
            .expect("should be tomorrow fajr");
        assert_eq!(next.0, "fajr");
        assert_eq!(next.1, dt("2025-08-21T02:00:00Z"));
    }

    #[test]
    fn should_fire_requires_either_toggle() {
        // Independent toggles per FR-4.3/FR-5.3 — fire when either is enabled.
        assert!(should_fire(true, true));
        assert!(should_fire(true, false));
        assert!(should_fire(false, true));
        assert!(!should_fire(false, false));
    }

    #[test]
    fn next_prayer_exact_time_advances_to_next() {
        let times = simple_day();
        // At exactly Fajr time, next should be Dhuhr (since we use > now, not >=)
        let now = dt("2025-08-20T02:00:00Z");
        let next = next_prayer(&times, now).expect("should advance");
        assert_eq!(next.0, "dhuhr");
    }
}
