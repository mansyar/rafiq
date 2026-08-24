import { describe, expect, it } from 'vitest';
import enCatalog from '@/i18n/locales/en.json';
import idCatalog from '@/i18n/locales/id.json';
import eventDefs from '../../src-tauri/assets/hijri-events/events.json';

/**
 * Cross-layer guard for track hijri-events_20260824: every observance bundled
 * in the Rust asset must have localized `name` + `description` entries in BOTH
 * catalogs, otherwise the UI would render raw i18n keys.
 */
describe('hijri-events catalog completeness', () => {
  const eventIds = (eventDefs as { id: string }[]).map((e) => e.id);

  it('bundles exactly the approved core set of observances', () => {
    expect(eventIds).toHaveLength(8);
  });

  for (const locale of ['en', 'id'] as const) {
    it(`localizes every bundled observance in the ${locale} catalog`, () => {
      const events = locale === 'en' ? enCatalog : idCatalog;
      const section = events.hijriEvents.events as Record<
        string,
        { name?: string; description?: string }
      >;

      for (const id of eventIds) {
        const entry = section[id];
        expect(entry, `${id} missing from ${locale} catalog`).toBeDefined();
        expect(entry.name, `${id}.name missing (${locale})`).toBeTruthy();
        expect(entry.description, `${id}.description missing (${locale})`).toBeTruthy();
      }
    });
  }

  it('provides the shared strip/marker strings in both catalogs', () => {
    for (const catalog of [enCatalog, idCatalog]) {
      const hijriEvents = catalog.hijriEvents as Record<string, unknown>;
      expect(hijriEvents.strip).toBeDefined();
      expect(hijriEvents.markerLabel).toBeDefined();
    }
  });
});
