import { expect, type Page, test } from '@playwright/test';
import { installMockTauri } from './helpers/mock-tauri';

/**
 * Hijri Events + Special Dates — AC-1…AC-3, AC-7 (spec).
 *
 * Deterministic clock fixture: `window.__RAFIQ_MOCK_TODAY__` (ISO YYYY-MM-DD)
 * drives every mock "today" derivation (today_hijri, month grid is_today,
 * daily rotation date, upcoming events), so event-day behaviour is testable
 * on any run date.
 *
 * Anchor: 2026-06-16 == 1 Muharram 1448 (verified Umm al-Qura anchor; the
 * mock's TEST-ONLY 30/29 alternation derives the other observance dates).
 */
const EVENT_DAY = '2026-06-16';

async function boot(page: Page, todayIso: string): Promise<void> {
  await page.addInitScript((iso) => {
    (window as unknown as Record<string, unknown>).__RAFIQ_MOCK_TODAY__ = iso;
  }, todayIso);
  await installMockTauri(page);
  await page.goto('/onboarding');
  await page.getByRole('button', { name: /skip/i }).click();
  await expect(page).toHaveURL('/');
}

test.describe('Hijri Events', () => {
  // AC-1: on an observance day the strip leads with a distinct "Today:"
  // emphasis and the Daily Reflection card shows the themed override badge.
  test('event day leads strip with Today pill and overrides reflection', async ({ page }) => {
    await boot(page, EVENT_DAY);
    const strip = page.getByTestId('upcoming-events-strip');
    await expect(strip.getByText('Upcoming observances')).toBeVisible();

    const first = strip.locator('li').first();
    await expect(first.getByTestId('today-pill')).toHaveText('Today:');
    await expect(first).toContainText('Islamic New Year');

    const badge = page.getByTestId('event-badge');
    await expect(badge).toHaveText('Islamic New Year');
  });

  // AC-2 guard: on an ordinary day there is no Today pill and no override;
  // the strip simply starts with the next upcoming observance.
  test('ordinary day has no Today pill and no reflection override', async ({ page }) => {
    await boot(page, '2026-06-18'); // 3 Muharram 1448 — ordinary day
    const strip = page.getByTestId('upcoming-events-strip');
    await expect(strip.locator('li').first()).toContainText('Day of Ashura');
    await expect(strip.getByTestId('today-pill')).toHaveCount(0);
    await expect(page.getByTestId('event-badge')).toHaveCount(0);
  });

  // AC-2: the strip crosses Gregorian-month and Hijri-year boundaries in
  // chronological order (from mid-Rajab 1448 the next three observances are
  // Ramadan begins → Laylat al-Qadr → Eid al-Fitr).
  test('strip crosses the Hijri year boundary chronologically', async ({ page }) => {
    await boot(page, '2026-12-20');
    const strip = page.getByTestId('upcoming-events-strip');
    await expect(strip.locator('li')).toHaveCount(3);
    await expect(strip.locator('li').nth(0)).toContainText('Ramadan begins');
    await expect(strip.locator('li').nth(1)).toContainText('Laylat al-Qadr');
    await expect(strip.locator('li').nth(2)).toContainText('Eid al-Fitr');
  });

  // AC-3: calendar renders gold markers with accessible tooltips; the grid
  // opens directly on Muharram 1448 because the mocked today falls on it.
  test('calendar shows gold markers with accessible tooltips', async ({ page }) => {
    await boot(page, EVENT_DAY);
    await page.goto('/calendar');

    const newYearMarker = page.getByRole('button', { name: /Islamic New Year/ });
    await expect(newYearMarker).toBeVisible();
    const ashuraMarker = page.getByRole('button', { name: /Day of Ashura/ });
    await expect(ashuraMarker).toBeVisible();

    // Keyboard focus reveals the tooltip (group-focus-within).
    await ashuraMarker.focus();
    await expect(page.getByText(/recommended day of fasting/)).toBeVisible();
  });

  // FR-4: the estimated flag reaches the grid payload data-driven (rendered
  // as the "(estimated)" suffix by the marker tooltip label).
  test('grid payload flags Laylat al-Qadr as estimated', async ({ page }) => {
    await boot(page, EVENT_DAY);
    const grid = (await page.evaluate(async () => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      return (await w.__TAURI__!.core.invoke('hijri_month_grid', {
        year: 1448,
        month: 9,
      })) as {
        days: Array<{ hijri_day: number; event_id: string | null; event_estimated: boolean }>;
      };
    })) as {
      days: Array<{ hijri_day: number; event_id: string | null; event_estimated: boolean }>;
    };

    const d27 = grid.days.find((d) => d.hijri_day === 27);
    expect(d27?.event_id).toBe('laylat_al_qadr');
    expect(d27?.event_estimated).toBe(true);
    const d5 = grid.days.find((d) => d.hijri_day === 5);
    expect(d5?.event_id).toBeNull();
  });

  // AC-7: full localization of the surface (Bahasa Indonesia).
  test('observances surface localizes to Bahasa Indonesia', async ({ page }) => {
    await boot(page, EVENT_DAY);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Bahasa Indonesia' }).click();

    await page.goto('/');
    const strip = page.getByTestId('upcoming-events-strip');
    await expect(strip.getByText('Peringatan mendatang')).toBeVisible();
    await expect(page.getByText('Tahun Baru Islam').first()).toBeVisible();
  });

  // FR-2 payload sanity via the command surface.
  test('get_upcoming_hijri_events honors limit and flags today', async ({ page }) => {
    await boot(page, EVENT_DAY);
    const events = (await page.evaluate(async () => {
      const w = window as unknown as {
        __TAURI__?: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } };
      };
      return (await w.__TAURI__!.core.invoke('get_upcoming_hijri_events', {
        limit: 3,
      })) as Array<{
        id: string;
        hijri_year: number;
        gregorian_date: string;
        is_today: boolean;
        estimated: boolean;
      }>;
    })) as Array<{
      id: string;
      hijri_year: number;
      gregorian_date: string;
      is_today: boolean;
      estimated: boolean;
    }>;

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      id: 'islamic_new_year',
      hijri_year: 1448,
      gregorian_date: '2026-06-16',
      is_today: true,
      estimated: false,
    });
    expect(events.map((e) => e.id)).toEqual(['islamic_new_year', 'ashura', 'mawlid_an_nabi']);
  });
});
