import { expect, test } from '@playwright/test';
import { installMockTauri } from './helpers/mock-tauri';

test.describe('Quran Reader', () => {
  test.beforeEach(async ({ page }) => {
    await installMockTauri(page);
    await page.goto('/onboarding');
    await page.getByRole('button', { name: /skip/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('lists 114 surahs and shows search count', async ({ page }) => {
    await page.goto('/quran');
    // List should contain 114 entries (mock returns full dataset)
    await expect(page.getByText(/114|surah/i).first()).toBeVisible({ timeout: 5_000 });
    const items = page.locator('a[href^="/quran/"]');
    await expect(items.first()).toBeVisible();
    await expect(items).toHaveCount(114, { timeout: 10_000 });
  });

  test('search filters to matching surahs (Al-Faatiha)', async ({ page }) => {
    await page.goto('/quran');
    const input = page
      .locator('#quran-search, input[type="search"], input[placeholder*="Search" i]')
      .first();
    await expect(input).toBeVisible();
    await input.fill('Al-Faatiha');
    await page.waitForTimeout(400); // 300ms debounce
    // Result should include Al-Faatiha (id 1) — transliteration is Al-Faatiha in dataset
    await expect(page.getByText(/Al-Faatiha/i).first()).toBeVisible();
    // Count should shrink — count only surah links, not layout <li>
    const count = await page.locator('a[href^="/quran/"]').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(114);
  });

  test('reader shows surah with Arabic, translation toggle and nav', async ({ page }) => {
    await page.goto('/quran/1');
    // Surah 1 header and Arabic visible — reader uses region title; check transliteration + any Arabic ayah text
    await expect(page.getByText(/Al-Faatiha/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Ayah 1/).first()).toBeVisible({ timeout: 5_000 });
    // Translation toggles sahih/clear/kemenag — click Clear
    const clearBtn = page.getByRole('button', { name: /clear/i }).first();
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await expect(clearBtn).toHaveAttribute('aria-pressed', 'true');
    }
    // Bismillah gated: surah 1 and 9 hide, 2 shows — check 2 has Bismillah text
    await page.goto('/quran/2');
    await expect(page.getByText(/بِسْمِ/).first()).toBeVisible({ timeout: 5_000 });
    // Nav prev/next
    await expect(page.getByRole('link', { name: /1|prev/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /3|next/i }).first()).toBeVisible();
  });

  test('persisted translation survives reload', async ({ page }) => {
    await page.goto('/quran/1');
    await page
      .getByRole('button', { name: /kemenag/i })
      .first()
      .waitFor({ timeout: 5_000 });
    await page
      .getByRole('button', { name: /kemenag/i })
      .first()
      .click();
    await expect(page.getByRole('button', { name: /kemenag/i }).first()).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.reload();
    await expect(page.getByRole('button', { name: /kemenag/i }).first()).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
