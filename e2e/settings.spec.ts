import { expect, test } from '@playwright/test';
import { installMockTauri } from './helpers/mock-tauri';

/**
 * Settings page critical paths (spec FR-2 / plan Phase 4).
 * Runs against the mocked Tauri backend: settings persist through
 * localStorage-backed get_setting/set_setting, mirroring SQLite.
 */
test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await installMockTauri(page);
    // Complete onboarding so the guard lets us reach /settings
    await page.goto('/onboarding');
    await page.getByRole('button', { name: /skip/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('language switch EN→ID re-renders UI and persists across reload', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('#page-settings')).toHaveText('Settings');
    await expect(page.getByText('Language', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Bahasa Indonesia' }).click();
    // Legend + card title re-render in Indonesian
    await expect(page.getByText('Bahasa', { exact: true })).toBeVisible();
    await expect(page.locator('#page-settings')).toHaveText('Pengaturan');

    await page.reload();
    await expect(page.locator('#page-settings')).toHaveText('Pengaturan');

    // Switch back for deterministic state in later suites
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.locator('#page-settings')).toHaveText('Settings');
  });

  test('method switch marks selection and persists across reload', async ({ page }) => {
    await page.goto('/settings');
    const isna = page.getByRole('button', { name: 'ISNA' });
    const defaultMwl = page.getByRole('button', { name: 'Muslim World League' });
    await expect(defaultMwl).toHaveAttribute('aria-pressed', 'true');

    await isna.click();
    await expect(isna).toHaveAttribute('aria-pressed', 'true');
    await expect(defaultMwl).toHaveAttribute('aria-pressed', 'false');

    // Prayer-times query invalidates without erroring; persisted method survives reload
    await page.reload();
    await expect(page.getByRole('button', { name: 'ISNA' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('notification and adhan toggles persist across reload', async ({ page }) => {
    await page.goto('/settings');
    const notifRow = page.locator('div.space-y-4 > div', { hasText: 'Prayer notifications' });
    const adhanRow = page.locator('div.space-y-4 > div', { hasText: 'Adhan sound' });

    // Defaults are enabled
    await expect(notifRow.getByRole('button')).toHaveText('On');
    await expect(adhanRow.getByRole('button')).toHaveText('On');

    await notifRow.getByRole('button').click();
    await adhanRow.getByRole('button').click();
    await expect(notifRow.getByRole('button')).toHaveText('Off');
    await expect(adhanRow.getByRole('button')).toHaveText('Off');

    await page.reload();
    await expect(
      page.locator('div.space-y-4 > div', { hasText: 'Prayer notifications' }).getByRole('button'),
    ).toHaveText('Off');
    await expect(
      page.locator('div.space-y-4 > div', { hasText: 'Adhan sound' }).getByRole('button'),
    ).toHaveText('Off');
  });

  test('city search → select → resolved location updates (and survives reload)', async ({
    page,
  }) => {
    await page.goto('/settings');
    await page.fill('#settings-city-search', 'Jakarta');
    const results = page.locator('#settings-city-results');
    const first = results.getByRole('button').first();
    await expect(first).toBeVisible({ timeout: 10_000 }); // 300ms debounce + query
    await first.click();

    await expect(page.getByText('Location saved')).toBeVisible();

    // Resolved location now points at a Jakarta city entry
    const resolved = (await page.evaluate(async () => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      return (await w.__TAURI__!.core.invoke('get_resolved_location')) as {
        city: { id: string; name: string; country: string } | null;
      } | null;
    }))!;
    expect(resolved?.city?.name.toLowerCase()).toContain('jakarta');

    await page.reload();
    const afterReload = (await page.evaluate(async () => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      return (await w.__TAURI__!.core.invoke('get_resolved_location')) as {
        city: { id: string; name: string } | null;
      } | null;
    }))!;
    expect(afterReload?.city?.id).toBe(resolved.city.id);
  });
});
