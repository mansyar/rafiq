import { expect, test } from '@playwright/test';
import { installMockTauri } from './helpers/mock-tauri';

/**
 * Onboarding E2E — /onboarding wizard + OnboardingGuard redirects.
 * Runs against the mocked Tauri backend (Vite, no native deps).
 */
test.describe('Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await installMockTauri(page);
  });

  test('guard redirects fresh install to /onboarding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByText(/1.*4|step.*1/i).first()).toBeVisible();
  });

  test('wizard steps through Welcome -> Language -> Location -> Method and finishes', async ({
    page,
  }) => {
    await page.goto('/onboarding');
    // Welcome slide visible
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /skip/i })).toBeVisible();
    // Next through 3 steps to Method
    const nextBtn = page.getByRole('button', { name: /^next$/i });
    await nextBtn.click();
    await expect(page.getByRole('heading', { name: /language/i })).toBeVisible();
    await nextBtn.click();
    await expect(page.getByRole('heading', { name: /location/i })).toBeVisible();
    await nextBtn.click();
    await expect(page.getByRole('heading', { name: /method/i })).toBeVisible();
    // Back still works
    await expect(page.getByRole('button', { name: /back/i })).toBeEnabled();
    await page.getByRole('button', { name: /back/i }).click();
    await expect(page.getByRole('heading', { name: /location/i })).toBeVisible();
    await nextBtn.click();
    // Finish exits wizard
    await page.getByRole('button', { name: /finish/i }).click();
    await expect(page).toHaveURL('/');
    // Guard now allows Today
    await page.reload();
    await expect(page).not.toHaveURL(/\/onboarding/);
  });

  test('Skip immediately completes onboarding', async ({ page }) => {
    await page.goto('/onboarding');
    await page.getByRole('button', { name: /skip/i }).click();
    await expect(page).toHaveURL('/');
    await page.goto('/onboarding');
    // Re-entering manually still shows wizard (no forced redirect back), but guard lets Today pass
    // Verify guard: navigating to / stays out of onboarding
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/onboarding/);
  });

  test('persisted complete survives reload (query cache + settings)', async ({ page }) => {
    await page.goto('/onboarding');
    await page.getByRole('button', { name: /skip/i }).click();
    await expect(page).toHaveURL('/');
    await page.reload();
    await expect(page).not.toHaveURL(/\/onboarding/);
    // Verify setting persisted via invoke
    const v = await page.evaluate(async () => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      return (await w.__TAURI__!.core.invoke('get_setting', { key: 'onboarding_complete' })) as
        | string
        | null;
    });
    expect(v).toBe('true');
  });
});
