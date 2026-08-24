import { invoke } from '@tauri-apps/api/core';

// ── Types mirrored from Rust (src-tauri/src/hijri/mod.rs) ──────────────────

export interface HijriDate {
  year: number;
  month: number;
  day: number;
}

export interface GregorianDate {
  year: number;
  month: number;
  day: number;
  /** 0 = Sunday .. 6 = Saturday. */
  weekday: number;
}

export interface GridDay {
  /** Hijri day of the month (1-based). */
  hijri_day: number;
  gregorian_year: number;
  gregorian_month: number;
  gregorian_day: number;
  /** 0 = Sunday .. 6 = Saturday. */
  weekday: number;
  is_today: boolean;
  /** Bundled observance id hosted on this civil date (spec FR-2), else null. */
  event_id?: string | null;
  /** Mirrors the observance's `estimated` flag (false when event_id is null). */
  event_estimated?: boolean;
}

export interface MonthGrid {
  hijri_year: number;
  hijri_month: number;
  /** Number of days in the month (29 or 30 per Umm al-Qura). */
  day_count: number;
  days: GridDay[];
}

// ── Tauri invoke wrappers ─────────────────────────────────────────────────

/** Converts a Gregorian (ISO) date to the Umm al-Qura Hijri calendar. */
export async function hijriFromGregorian(
  year: number,
  month: number,
  day: number,
): Promise<HijriDate> {
  return invoke<HijriDate>('hijri_from_gregorian', { year, month, day });
}

/** Converts an Umm al-Qura Hijri date to a Gregorian (ISO) date. */
export async function hijriToGregorian(
  year: number,
  month: number,
  day: number,
): Promise<GregorianDate> {
  return invoke<GregorianDate>('hijri_to_gregorian', { year, month, day });
}

/** Grid of all days in a Hijri month; `is_today` reflects the app's local today. */
export async function getMonthGrid(year: number, month: number): Promise<MonthGrid> {
  return invoke<MonthGrid>('hijri_month_grid', { year, month });
}

/** Today's local date expressed in the Umm al-Qura Hijri calendar. */
export async function todayHijri(): Promise<HijriDate> {
  return invoke<HijriDate>('today_hijri');
}

// ── Hijri events (spec FR-2/FR-3) ─────────────────────────────────────────

export interface UpcomingEvent {
  /** Stable observance id — keys into `hijriEvents.events.*` i18n entries. */
  id: string;
  hijri_year: number;
  /** Civil date, YYYY-MM-DD. */
  gregorian_date: string;
  is_today: boolean;
  estimated: boolean;
}

/** Upcoming Hijri observances starting today, chronological (default 3). */
export async function getUpcomingHijriEvents(limit = 3): Promise<UpcomingEvent[]> {
  return invoke<UpcomingEvent[]>('get_upcoming_hijri_events', { limit });
}
