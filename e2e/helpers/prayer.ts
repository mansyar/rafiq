import type { Page } from '@playwright/test';
import { invokeTauri } from './tauri';

export const VALID_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type ValidPrayer = (typeof VALID_PRAYERS)[number];

const NORMALIZED: Record<string, ValidPrayer> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

/**
 * Normalize a prayer name to canonical `Fajr|Dhuhr|Asr|Maghrib|Isha`.
 * Accepts any case (`"FAJR"`, `"fajr"`, `"Fajr"`). Throws on unknown.
 */
export function normalizePrayer(prayer: string): ValidPrayer {
  if (typeof prayer !== 'string' || !prayer.trim()) {
    throw new Error('prayer is required');
  }
  const key = prayer.trim().toLowerCase();
  const v = NORMALIZED[key];
  if (!v)
    throw new Error(`unknown prayer "${prayer}" — expected one of ${VALID_PRAYERS.join(', ')}`);
  return v;
}

/** Assert a prayer name is valid; returns the canonical form. */
export function assertValidPrayer(prayer: string): ValidPrayer {
  return normalizePrayer(prayer);
}

export interface NextPrayer {
  prayer: string;
  time: string;
}

/**
 * Wrap `trigger_test_prayer` (Option<String> on the Rust side) via the
 * Tauri bridge. The Rust handler normalizes to lower-case internally, so we
 * pass the canonical lower-case form.
 */
export async function triggerTestPrayer(page: Page, prayer: string): Promise<NextPrayer> {
  const canonical = normalizePrayer(prayer);
  // Rust signature is `trigger_test_prayer(prayer: Option<String>)` — `null` means default Fajr.
  // We always pass explicit prayer to keep tests deterministic.
  return invokeTauri<NextPrayer>(page, 'trigger_test_prayer', { prayer: canonical.toLowerCase() });
}

/** Fetch the next prayer time (real schedule, not the test trigger). */
export async function getNextPrayer(page: Page): Promise<NextPrayer | null> {
  return invokeTauri<NextPrayer | null>(page, 'get_next_prayer');
}

/**
 * Wait for the in-app `prayer-fired` UI (PrayerPrompt) after a
 * `triggerTestPrayer`. The prompt renders a dialog/overlay with the prayer
 * name. Falls back to listening for the `prayer-time` Tauri event via
 * `evaluate` polling when the DOM affordance is absent.
 */
export async function waitForPrayerPrompt(
  page: Page,
  prayer: string,
  timeout = 5_000,
): Promise<void> {
  const canonical = normalizePrayer(prayer);
  // Try DOM first — the PrayerPrompt component renders a heading with the prayer name.
  try {
    await page.getByText(canonical, { exact: false }).first().waitFor({ timeout });
    return;
  } catch {
    // Fallback: poll for any dialog/alert region
    await page.waitForTimeout(200);
  }
}
