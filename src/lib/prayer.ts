import { invoke } from '@tauri-apps/api/core';

// ── Types mirrored from Rust ──────────────────────────────────────────────

export type CalculationMethod =
  | 'muslim_world_league'
  | 'isna'
  | 'egyptian'
  | 'umm_al_qura'
  | 'karachi'
  | 'tehran'
  | 'jafari';

export const CALCULATION_METHODS: readonly CalculationMethod[] = [
  'muslim_world_league',
  'isna',
  'egyptian',
  'umm_al_qura',
  'karachi',
  'tehran',
  'jafari',
] as const;

export const DEFAULT_CALCULATION_METHOD: CalculationMethod = 'muslim_world_league';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export interface City {
  id: string;
  name: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface Location {
  city_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export type PrayerName = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

// ── Tauri invoke wrappers ─────────────────────────────────────────────────

export async function getPrayerTimes(params: {
  date: string; // YYYY-MM-DD
  coordinates: Coordinates;
  method?: CalculationMethod | null;
}): Promise<PrayerTimes> {
  return invoke<PrayerTimes>('get_prayer_times', {
    date: params.date,
    coordinates: params.coordinates,
    method: params.method ?? null,
  });
}

export async function getLocation(): Promise<Location | null> {
  return invoke<Location | null>('get_location');
}

export async function setLocation(location: Location): Promise<void> {
  await invoke('set_location', { location });
}

export async function searchCities(query: string, limit?: number): Promise<City[]> {
  return invoke<City[]>('search_cities', { query, limit: limit ?? null });
}

export async function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>('get_setting', { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  await invoke('set_setting', { key, value });
}

export async function getCalculationMethod(): Promise<CalculationMethod> {
  const raw = await getSetting('prayer_calculation_method');
  if (raw && (CALCULATION_METHODS as readonly string[]).includes(raw)) {
    return raw as CalculationMethod;
  }
  return DEFAULT_CALCULATION_METHOD;
}

export async function setCalculationMethod(method: CalculationMethod): Promise<void> {
  await setSetting('prayer_calculation_method', method);
}

// ── Toggles (persisted as "1"/"0" or "true"/"false" — tolerant read) ───────

export async function getNotificationEnabled(): Promise<boolean> {
  const raw = await getSetting('notification_enabled');
  if (raw === null || raw === undefined) return true; // default enabled
  return raw === '1' || raw === 'true' || raw === 'enabled';
}

export async function setNotificationEnabled(enabled: boolean): Promise<void> {
  await setSetting('notification_enabled', enabled ? '1' : '0');
}

export async function getAdhanEnabled(): Promise<boolean> {
  const raw = await getSetting('adhan_enabled');
  if (raw === null || raw === undefined) return true;
  return raw === '1' || raw === 'true' || raw === 'enabled';
}

export async function setAdhanEnabled(enabled: boolean): Promise<void> {
  await setSetting('adhan_enabled', enabled ? '1' : '0');
}

// ── Helpers (logic-bearing, unit-tested) ───────────────────────────────────

/** Returns today's date as `YYYY-MM-DD` in local time. */
export function todayDateString(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Formats an RFC3339 UTC instant (`2025-08-20T10:07:00Z`) to localized `HH:mm`. */
export function formatPrayerTime(isoString: string, locale?: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return isoString;
  }
}

/** Ordered prayer keys for display and next-prayer calculation. */
export const PRAYER_ORDER: readonly PrayerName[] = [
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
] as const;

export const PRAYER_ORDER_WITHOUT_SUNRISE: readonly PrayerName[] = [
  'fajr',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
] as const;

/**
 * Returns the next upcoming prayer (from `PRAYER_ORDER_WITHOUT_SUNRISE`) after `now`.
 * If all today's prayers have passed, returns `null` (caller may show fajr tomorrow).
 */
export function getNextPrayer(
  times: PrayerTimes,
  now = new Date(),
  opts?: { includeSunrise?: boolean },
): { name: PrayerName; time: string } | null {
  const order = opts?.includeSunrise ? PRAYER_ORDER : PRAYER_ORDER_WITHOUT_SUNRISE;
  let next: { name: PrayerName; time: string; date: Date } | null = null;

  for (const name of order) {
    const iso = times[name];
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) continue;
    if (date.getTime() > now.getTime()) {
      if (next === null || date.getTime() < next.date.getTime()) {
        next = { name, time: iso, date };
      }
    }
  }
  if (!next) return null;
  return { name: next.name, time: next.time };
}

/** Returns `true` when `isoString` (UTC) is in the past relative to `now`. */
export function isPast(isoString: string, now = new Date()): boolean {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < now.getTime();
}

/** Lightweight runtime check for calculation method. */
export function isCalculationMethod(value: unknown): value is CalculationMethod {
  return typeof value === 'string' && (CALCULATION_METHODS as readonly string[]).includes(value);
}
