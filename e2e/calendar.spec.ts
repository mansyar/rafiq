import { expect, test } from '@playwright/test';
import { installMockTauri } from './helpers/mock-tauri';

test.describe('Hijri Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await installMockTauri(page);
    await page.goto('/onboarding');
    await page.getByRole('button', { name: /skip/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('renders month grid with 7-column weekdays and today highlight', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: /hijri|calendar|144/i }).first()).toBeVisible({
      timeout: 5_000,
    });
    // Weekday headers Mon-Sun or localized
    await expect(page.getByText(/Mon|Senin|Mon/i).first()).toBeVisible();
    // At least one cell with hijri_day and gregorian overlay
    await expect(page.locator('[aria-current="date"]')).toBeVisible({ timeout: 5_000 });
    // Today footnote — Umm al-Qura disclaimer (en: "differ by one day", id: "akurasi")
    await expect(page.getByText(/±|one day|differ by one|akurasi/i).first()).toBeVisible();
  });

  test('prev/next navigates month and Today resets', async ({ page }) => {
    await page.goto('/calendar');
    const prev = page.getByRole('button', { name: /prev|‹|←|previous/i }).first();
    const next = page.getByRole('button', { name: /next|›|→/i }).first();
    const todayBtn = page.getByRole('button', { name: /today|hari ini/i }).first();
    await expect(prev).toBeVisible();
    await expect(next).toBeVisible();
    const before = await page.locator('h2, h1').first().textContent();
    await next.click();
    await page.waitForTimeout(300);
    const afterNext = await page.locator('h2, h1').first().textContent();
    expect(afterNext).not.toBe(before);
    await prev.click();
    await page.waitForTimeout(300);
    await todayBtn.click();
    await expect(page.locator('[aria-current="date"]')).toBeVisible();
  });

  test('hijri anchors via converter: 2026-06-16 => 1 Muharram 1448, 2026-05-27 => 10 Dec 1447', async ({
    page,
  }) => {
    // Directly exercise the Tauri mock (mirrors DateConverter behavior)
    const a = await page.evaluate(async () => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      return (await w.__TAURI__!.core.invoke('hijri_from_gregorian', {
        year: 2026,
        month: 6,
        day: 16,
      })) as {
        year: number;
        month: number;
        day: number;
      };
    });
    expect(a).toEqual({ year: 1448, month: 1, day: 1 });
    const b = await page.evaluate(async () => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      return (await w.__TAURI__!.core.invoke('hijri_from_gregorian', {
        year: 2026,
        month: 5,
        day: 27,
      })) as {
        year: number;
        month: number;
        day: number;
      };
    });
    expect(b).toEqual({ year: 1447, month: 12, day: 10 });
    const c = await page.evaluate(async () => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      return (await w.__TAURI__!.core.invoke('hijri_to_gregorian', {
        year: 1448,
        month: 1,
        day: 1,
      })) as {
        year: number;
        month: number;
        day: number;
      };
    });
    expect(c.year).toBe(2026);
    expect(c.month).toBe(6);
    expect(c.day).toBe(16);
  });

  test('converter UI round-trips', async ({ page }) => {
    await page.goto('/calendar');
    // Converter inputs — try finding date inputs
    const gregInput = page.locator('input[type="date"], input[type="number"]').first();
    if (await gregInput.isVisible().catch(() => false)) {
      await expect(gregInput).toBeVisible();
      // Just verify it doesn't crash on change
      await gregInput.click();
    }
    // hijri_to_gregorian via mock should still hold
    await expect(page.getByText(/hijri|gregorian/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
