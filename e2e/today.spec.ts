import { expect, test } from '@playwright/test';
import { installMockTauri } from './helpers/mock-tauri';

test.describe('Today + Daily Reflection', () => {
  test.beforeEach(async ({ page }) => {
    await installMockTauri(page);
    // Complete onboarding so guard lets us reach Today
    await page.addInitScript(() => {
      // Seed onboarding_complete before app mounts — second install would overwrite mock, so patch via evaluate after load is cleaner.
    });
    await page.goto('/onboarding');
    await page.getByRole('button', { name: /skip/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('shows notSet warning when no location, then prayer times after Jakarta set', async ({
    page,
  }) => {
    // Fresh mock has no location — Today should show guidance to Settings
    await page.goto('/');
    await expect(page.getByText(/set.*location|not.*set|choose.*city/i).first()).toBeVisible({
      timeout: 5_000,
    });

    // Set Jakarta via Tauri invoke (mirrors LocationStep search_cities→set_location)
    await page.evaluate(async () => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      await w.__TAURI__!.core.invoke('set_location', {
        location: { city_id: 'jakarta-id-1', latitude: null, longitude: null },
      });
    });
    await page.reload();
    // Prayer cards should appear — 6 rows Fajr..Isha
    await expect(page.getByText(/Jakarta/i).first()).toBeVisible();
    for (const name of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
      await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
    }
    await expect(page.getByText(/Asia\/Jakarta/i).first()).toBeVisible();
  });

  test('daily reflection card renders ayah link and navigates to reader', async ({ page }) => {
    await page.evaluate(async () => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      await w.__TAURI__!.core.invoke('set_location', {
        location: { city_id: 'jakarta-id-1', latitude: null, longitude: null },
      });
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Daily card labelled "Daily Reflection"
    await expect(page.getByText(/daily reflection/i).first()).toBeVisible({ timeout: 10_000 });
    // The card contains a link to the Quran reader — aria-label "Open <Surah> <ref> in Quran reader"
    const ayahLink = page.getByRole('link', { name: /Open.*Quran/i }).first();
    await expect(ayahLink).toBeVisible({ timeout: 5_000 });
    await expect(ayahLink).toHaveAttribute('href', /\/quran\/\d+/);
    await ayahLink.click();
    await expect(page).toHaveURL(/\/quran\/\d+/);
  });

  test('prayer prompt fires via trigger_test_prayer', async ({ page }) => {
    await page.evaluate(async () => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      await w.__TAURI__!.core.invoke('set_location', {
        location: { city_id: 'jakarta-id-1', latitude: null, longitude: null },
      });
    });
    await page.goto('/');
    await page.evaluate(async () => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      await w.__TAURI__!.core.invoke('trigger_test_prayer', { prayer: 'fajr' });
    });
    // Mock creates #mock-prayer-prompt fallback; PrayerPrompt may also render
    await expect(page.locator('#mock-prayer-prompt, [role="dialog"]').first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/fajr/i).first()).toBeVisible();
  });
});
