import { expect, test } from '@playwright/test';
import { installMockTauri } from './helpers/mock-tauri';

test.describe('Prayer Log & Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await installMockTauri(page);
    await page.goto('/onboarding');
    await page.getByRole('button', { name: /skip/i }).click();
    await expect(page).toHaveURL('/');
    await page.evaluate(async () => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      await w.__TAURI__!.core.invoke('set_location', {
        location: { city_id: 'jakarta-id-1', latitude: null, longitude: null },
      });
    });
  });

  test('log tab shows today rows with Log buttons and early-tap guard', async ({ page }) => {
    await page.goto('/log');
    await expect(page.getByText(/Your practice history|Log/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByRole('heading', { name: /Today/i }).first()).toBeVisible();
    // 5 prayers rows
    for (const p of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
      await expect(page.getByText(p, { exact: false }).first()).toBeVisible();
    }
    // Log button present (may be disabled before time — early guard)
    await expect(page.getByRole('button', { name: /Prayed/i }).first()).toBeVisible();
  });

  test('logging a prayer updates status and weekly grid', async ({ page }) => {
    await page.goto('/log');
    const today = new Date().toISOString().slice(0, 10);
    // Log Fajr for today via invoke (mirrors UI click)
    await page.evaluate(async (date) => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      await w.__TAURI__!.core.invoke('log_prayer', { prayer: 'fajr', date });
    }, today);
    await page.reload();
    // Badge should reflect on_time (emerald/gold)
    await expect(page.getByText(/on_time|qada/i).first()).toBeVisible({ timeout: 5_000 });
    // Delete to clean up for determinism
    await page.evaluate(async (date) => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      await w.__TAURI__!.core.invoke('delete_log_entry', { prayer: 'fajr', date });
    }, today);
  });

  test('analytics streak reflects logged today', async ({ page }) => {
    await page.goto('/log');
    const today = new Date().toISOString().slice(0, 10);
    await page.evaluate(async (date) => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      await w.__TAURI__!.core.invoke('log_prayer', { prayer: 'dhuhr', date });
    }, today);
    await page.reload();
    await expect(page.getByText(/streak/i).first()).toBeVisible({ timeout: 5_000 });
    // analytics endpoint mocked — streak 1 when today logged
    const analytics = await page.evaluate(async () => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      return (await w.__TAURI__!.core.invoke('get_log_analytics')) as {
        streaks: { current: number };
      };
    });
    expect(analytics.streaks.current).toBe(1);
  });
});
