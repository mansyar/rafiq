import { existsSync, readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

/**
 * Installs a full in-browser mock for `window.__TAURI__.core.invoke` so
 * `pnpm e2e` (Vite at 1420) can run the critical-path specs without a real
 * Rust backend or tauri-driver.
 *
 * Persistence: settings / location / prayer log are backed by
 * `localStorage` (key `rafiq:e2e:mock`) so a `page.reload()` or
 * `page.goto` keeps onboarding_complete and Jakarta across navigations —
 * matching Rust's SQLite persistence.
 *
 * Also stubs `window.__TAURI_INTERNALS__.transformCallback` and generic
 * `plugin:*` invokes so `@tauri-apps/api/event.listen` does not throw.
 */
export async function installMockTauri(page: Page): Promise<void> {
  let quranData: unknown = null;
  let citiesData: unknown = null;
  let ayahsData: unknown = null;
  let hadithsData: unknown = null;
  try {
    if (existsSync('src-tauri/assets/quran/quran.json')) {
      quranData = JSON.parse(readFileSync('src-tauri/assets/quran/quran.json', 'utf8'));
    } else if (existsSync('src-tauri/assets/quran.json')) {
      quranData = JSON.parse(readFileSync('src-tauri/assets/quran.json', 'utf8'));
    }
  } catch {}
  try {
    if (existsSync('src-tauri/assets/cities.json')) {
      citiesData = JSON.parse(readFileSync('src-tauri/assets/cities.json', 'utf8'));
    }
  } catch {}
  try {
    if (existsSync('src-tauri/assets/daily/ayahs.json')) {
      ayahsData = JSON.parse(readFileSync('src-tauri/assets/daily/ayahs.json', 'utf8'));
    }
  } catch {}
  try {
    if (existsSync('src-tauri/assets/daily/hadiths.json')) {
      hadithsData = JSON.parse(readFileSync('src-tauri/assets/daily/hadiths.json', 'utf8'));
    }
  } catch {}

  const quranPayload = JSON.stringify(quranData);
  const citiesPayload = JSON.stringify(citiesData);
  const ayahsPayload = JSON.stringify(ayahsData);
  const hadithsPayload = JSON.stringify(hadithsData);

  await page.addInitScript(
    ({ quranJson, citiesJson, ayahsJson, hadithsJson }) => {
      // @ts-expect-error
      if (window.__TAURI__?.core?.invoke) return;

      const STORAGE_KEY = 'rafiq:e2e:mock';
      type Persisted = {
        settings: Record<string, string>;
        location: {
          city_id: string | null;
          latitude: number | null;
          longitude: number | null;
        } | null;
        prayerLog: Array<{ date: string; prayer: string; status: string; logged_at: string }>;
        quranTranslation: string;
      };
      function loadPersisted(): Persisted {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) return JSON.parse(raw) as Persisted;
        } catch {}
        return { settings: {}, location: null, prayerLog: [], quranTranslation: 'sahih' };
      }
      function savePersisted(p: Persisted) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
        } catch {}
      }
      const persisted = loadPersisted();
      const settings = new Map<string, string>(Object.entries(persisted.settings));
      let location = persisted.location as Persisted['location'];
      const prayerLog: Persisted['prayerLog'] = persisted.prayerLog;
      let quranTranslation: string = persisted.quranTranslation || 'sahih';
      const recitationIndex: Map<
        number,
        { global_ayah: number; file_path: string; size_bytes: number }
      > = new Map();
      /** Last position reported by the player (in-memory, per session). */
      let lastPlayed: { surahId: number; ayah: number } | null = null;
      /** Registered Tauri event listeners: listenerId → {event, handlerKey}. */
      const eventListeners = new Map<number, { event: string; handlerKey: string }>();
      let nextListenerId = 1;

      function persist() {
        savePersisted({
          settings: Object.fromEntries(settings.entries()),
          location,
          prayerLog,
          quranTranslation,
        });
      }

      const QURAN_DATA = quranJson ? JSON.parse(quranJson as string) : null;
      const CITIES_DATA: Array<{
        id: string;
        name: string;
        country: string;
        country_code: string;
        latitude: number;
        longitude: number;
        timezone: string;
      }> = citiesJson ? JSON.parse(citiesJson as string) : [];
      const DAILY_AYAHS: Array<{ surah_id: number; ayah_number: number; id?: string }> = ayahsJson
        ? JSON.parse(ayahsJson as string)
        : [];
      const DAILY_HADITHS: Array<unknown> = hadithsJson ? JSON.parse(hadithsJson) : [];

      // ── Hijri events fixture (mirrors src-tauri/assets/hijri-events/) ─────
      const HIJRI_EVENTS: Array<{
        id: string;
        hijri_month: number;
        hijri_day: number;
        estimated: boolean;
      }> = [
        { id: 'islamic_new_year', hijri_month: 1, hijri_day: 1, estimated: false },
        { id: 'ashura', hijri_month: 1, hijri_day: 10, estimated: false },
        { id: 'mawlid_an_nabi', hijri_month: 3, hijri_day: 12, estimated: false },
        { id: 'ramadan_begins', hijri_month: 9, hijri_day: 1, estimated: false },
        { id: 'laylat_al_qadr', hijri_month: 9, hijri_day: 27, estimated: true },
        { id: 'eid_al_fitr', hijri_month: 10, hijri_day: 1, estimated: false },
        { id: 'arafah', hijri_month: 12, hijri_day: 9, estimated: false },
        { id: 'eid_al_adha', hijri_month: 12, hijri_day: 10, estimated: false },
      ];
      /** Thematic ayah refs per event (real refs from hijri-events/content.json). */
      const EVENT_CONTENT: Record<string, { surah_id: number; ayah_number: number }> = {
        islamic_new_year: { surah_id: 9, ayah_number: 36 },
        ashura: { surah_id: 2, ayah_number: 183 },
        mawlid_an_nabi: { surah_id: 21, ayah_number: 107 },
        ramadan_begins: { surah_id: 2, ayah_number: 185 },
        laylat_al_qadr: { surah_id: 97, ayah_number: 1 },
        eid_al_fitr: { surah_id: 14, ayah_number: 7 },
        arafah: { surah_id: 5, ayah_number: 3 },
        eid_al_adha: { surah_id: 37, ayah_number: 107 },
      };
      /**
       * Deterministic clock override (spec FR-5/e2e): when
       * `window.__RAFIQ_MOCK_TODAY__` holds an ISO date (YYYY-MM-DD), every
       * mock "today" derivation uses it instead of the real clock.
       */
      function mockToday(): Date {
        const iso = (globalThis as Record<string, unknown>).__RAFIQ_MOCK_TODAY__;
        if (typeof iso === 'string') {
          const d = new Date(`${iso}T12:00:00Z`);
          if (!Number.isNaN(d.getTime())) return d;
        }
        return new Date();
      }
      function eventForHijri(hijriMonth: number, hijriDay: number) {
        return (
          HIJRI_EVENTS.find((e) => e.hijri_month === hijriMonth && e.hijri_day === hijriDay) ?? null
        );
      }

      function findCityById(id: string) {
        const t = String(id).trim();
        if (!t) return null;
        return CITIES_DATA.find((c) => c.id === t) ?? null;
      }
      function searchCities(query: string, limit: number | null) {
        const q = String(query ?? '')
          .trim()
          .toLowerCase();
        if (!q) return [];
        const capped = Math.min(Math.max(limit ?? 10, 1), 20);
        const scored: Array<{ score: number; city: (typeof CITIES_DATA)[number] }> = [];
        for (const c of CITIES_DATA) {
          const name = c.name.toLowerCase();
          const country = c.country.toLowerCase();
          let score: number | null = null;
          if (name === q || country === q) score = 0;
          else if (name.startsWith(q) || country.startsWith(q)) score = 1;
          else if (name.includes(q) || country.includes(q)) score = 2;
          else if (c.id.toLowerCase().includes(q)) score = 3;
          if (score !== null) scored.push({ score, city: c });
        }
        scored.sort((a, b) => a.score - b.score || a.city.name.localeCompare(b.city.name));
        return scored.slice(0, capped).map((s) => s.city);
      }
      function resolveLocation() {
        if (location?.city_id) {
          const city = findCityById(location.city_id);
          if (city) {
            return {
              city,
              latitude: city.latitude,
              longitude: city.longitude,
              timezone: city.timezone,
            };
          }
        }
        if (location && location.latitude !== null && location.longitude !== null) {
          return {
            city: null,
            latitude: location.latitude,
            longitude: location.longitude,
            timezone: 'UTC',
          };
        }
        return null;
      }
      function prayerTimesFor(date: string, _coords: { latitude: number; longitude: number }) {
        const [y, m, d] = date.split('-').map((n) => Number(n));
        const pad = (n: number) => String(n).padStart(2, '0');
        const iso = (h: number, min: number) =>
          `${y}-${pad(m)}-${pad(d)}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00Z`;
        return {
          fajr: iso(4, 50),
          sunrise: iso(6, 10),
          dhuhr: iso(12, 0),
          asr: iso(15, 30),
          maghrib: iso(18, 5),
          isha: iso(19, 20),
        };
      }
      function hijriFromGregorian(year: number, month: number, day: number) {
        if (year === 2026 && month === 6 && day === 16) return { year: 1448, month: 1, day: 1 };
        if (year === 2026 && month === 6 && day === 18) return { year: 1448, month: 1, day: 3 };
        if (year === 2026 && month === 5 && day === 27) return { year: 1447, month: 12, day: 10 };
        const anchorMs = Date.UTC(2026, 5, 16);
        const targetMs = Date.UTC(year, month - 1, day);
        const deltaDays = Math.round((targetMs - anchorMs) / 86_400_000);
        const daysInMockMonth = (m: number) => (m % 2 === 1 ? 30 : 29);
        let hYear = 1448;
        let hMonth = 1;
        let hDay = 1 + deltaDays;
        // Month-length-aware normalization (mirrors the backend engine).
        // A previous naive "> 30" loop swallowed each month's final day,
        // mis-mapping every Hijri month boundary (e.g. 1 Ramadan resolved
        // to 30 Rajab, hiding the observance from forward walks).
        let guard = 0;
        while (hDay > daysInMockMonth(hMonth) && guard < 2400) {
          hDay -= daysInMockMonth(hMonth);
          hMonth += 1;
          if (hMonth > 12) {
            hMonth = 1;
            hYear += 1;
          }
          guard += 1;
        }
        while (hDay < 1 && guard < 4800) {
          hMonth -= 1;
          if (hMonth < 1) {
            hMonth = 12;
            hYear -= 1;
          }
          hDay += daysInMockMonth(hMonth);
          guard += 1;
        }
        return { year: hYear, month: hMonth, day: hDay };
      }
      function hijriToGregorian(year: number, month: number, day: number) {
        if (year === 1448 && month === 1 && day === 1)
          return { year: 2026, month: 6, day: 16, weekday: 1 };
        if (year === 1447 && month === 12 && day === 10)
          return { year: 2026, month: 5, day: 27, weekday: 2 };
        const anchorHijri = { year: 1448, month: 1, day: 1 };
        const anchorGregMs = Date.UTC(2026, 5, 16);
        let delta = 0;
        let y = 1448;
        let m = 1;
        while (y < year || (y === year && m < month)) {
          const dim = m % 2 === 1 ? 30 : 29;
          delta += dim;
          m += 1;
          if (m > 12) {
            m = 1;
            y += 1;
          }
        }
        delta += day - 1;
        if (
          year < anchorHijri.year ||
          (year === anchorHijri.year && month < anchorHijri.month) ||
          (year === anchorHijri.year && month === anchorHijri.month && day < anchorHijri.day)
        ) {
          delta = -Math.abs(delta);
        }
        const ms = anchorGregMs + delta * 86_400_000;
        const d = new Date(ms);
        return {
          year: d.getUTCFullYear(),
          month: d.getUTCMonth() + 1,
          day: d.getUTCDate(),
          weekday: d.getUTCDay(),
        };
      }
      function getMonthGrid(year: number, month: number) {
        const nowD = mockToday();
        const today = hijriFromGregorian(
          nowD.getUTCFullYear(),
          nowD.getUTCMonth() + 1,
          nowD.getUTCDate(),
        );
        const dayCount = month === 12 && year === 1447 ? 30 : month % 2 === 1 ? 30 : 29;
        const firstGreg = hijriToGregorian(year, month, 1);
        const days: Array<{
          hijri_day: number;
          gregorian_year: number;
          gregorian_month: number;
          gregorian_day: number;
          weekday: number;
          is_today: boolean;
          event_id: string | null;
          event_estimated: boolean;
        }> = [];
        // Real calendar-day arithmetic (UTC noon-free midnight): the mock's
        // Hijri engine is day-based from the verified anchor, so each grid
        // cell's civil date is anchor + offset days. The previous naive
        // "+30 carry" corrupted dates in deep months and broke event stamping.
        const firstGregMs = Date.UTC(firstGreg.year, firstGreg.month - 1, firstGreg.day);
        for (let i = 1; i <= dayCount; i++) {
          const isToday = today.year === year && today.month === month && today.day === i;
          const gd = new Date(firstGregMs + (i - 1) * 86_400_000);
          const gYear = gd.getUTCFullYear();
          const gMonth = gd.getUTCMonth() + 1;
          const gDay = gd.getUTCDate();
          const cellH = hijriFromGregorian(gYear, gMonth, gDay);
          const cellEvent = eventForHijri(cellH.month, cellH.day);
          days.push({
            hijri_day: i,
            gregorian_year: gYear,
            gregorian_month: gMonth,
            gregorian_day: gDay,
            weekday: (firstGreg.weekday + (i - 1)) % 7,
            is_today: isToday,
            event_id: cellEvent ? cellEvent.id : null,
            event_estimated: cellEvent ? cellEvent.estimated : false,
          });
        }
        return { hijri_year: year, hijri_month: month, day_count: dayCount, days };
      }
      function listSurahs() {
        if (!QURAN_DATA || !(QURAN_DATA as { surahs?: unknown[] })) return [];
        const s = (QURAN_DATA as { surahs: Array<Record<string, unknown>> }).surahs ?? [];
        return s;
      }
      function getSurah(id: number) {
        const list = listSurahs() as Array<{ id: number }>;
        const found = list.find((c) => c.id === id);
        if (!found) throw new Error(`surah not found: ${id}`);
        return found;
      }
      function searchSurahs(query: string, limit: number | null) {
        const q = String(query ?? '')
          .trim()
          .toLowerCase();
        if (!q) return [];
        const capped = Math.min(Math.max(limit ?? 10, 1), 20);
        const all = listSurahs() as Array<{
          id: number;
          name_transliteration: string;
          name_en: string;
          name_id: string;
          name_ar: string;
        }>;
        const scored: Array<{ score: number; s: (typeof all)[number] }> = [];
        for (const s of all) {
          const translit = s.name_transliteration.toLowerCase();
          const en = s.name_en.toLowerCase();
          const id = s.name_id.toLowerCase();
          const idStr = String(s.id);
          let score: number | null = null;
          if (translit === q || en === q || id === q) score = 0;
          else if (translit.startsWith(q) || en.startsWith(q) || id.startsWith(q)) score = 1;
          else if (translit.includes(q) || en.includes(q) || id.includes(q)) score = 2;
          else if (s.name_ar.includes(query)) score = 3;
          else if (idStr === q) score = 4;
          else if (idStr.includes(q) && /^[0-9]+$/.test(q)) score = 5;
          if (score !== null) scored.push({ score, s });
        }
        scored.sort((a, b) => a.score - b.score);
        return scored.slice(0, capped).map((x) => x.s);
      }
      /** Resolve a curated ayah reference into the full response shape. */
      function resolveAyahRef(ref: { surah_id: number; ayah_number: number; id?: string }) {
        try {
          const surah = getSurah(ref.surah_id) as {
            id: number;
            name_en: string;
            name_ar: string;
            ayahs: Array<{
              number: number;
              arabic: string;
              sahih: string;
              clear: string;
              kemenag: string;
            }>;
          };
          const ayah = surah.ayahs.find((a) => a.number === ref.ayah_number);
          if (!ayah) return null;
          const tKey = (quranTranslation as string).toLowerCase() as 'sahih' | 'clear' | 'kemenag';
          const translation = (ayah as Record<string, string>)[tKey] ?? ayah.sahih;
          return {
            id: ref.id ?? `${ref.surah_id}:${ref.ayah_number}`,
            surah_id: ref.surah_id,
            ayah_number: ref.ayah_number,
            arabic: ayah.arabic,
            translation,
            surah_name_en: surah.name_en,
            surah_name_ar: surah.name_ar,
          };
        } catch {
          return null;
        }
      }
      function getDailyContent() {
        const lenAyah = DAILY_AYAHS.length || 1;
        const lenHadith = DAILY_HADITHS.length || 1;
        const start = Date.UTC(2026, 0, 1);
        const nowD = mockToday();
        const days = Math.floor((nowD.getTime() - start) / 86_400_000);
        const ayahRef = DAILY_AYAHS[((days % lenAyah) + lenAyah) % lenAyah];
        const hadith = DAILY_HADITHS[((days % lenHadith) + lenHadith) % lenHadith];
        const dateStr = nowD.toISOString().slice(0, 10);
        const ayahResolved =
          ayahRef && typeof ayahRef === 'object' && 'surah_id' in (ayahRef as object)
            ? (resolveAyahRef(ayahRef as { surah_id: number; ayah_number: number; id?: string }) ??
              ayahRef)
            : ayahRef;
        // Observance-day override (spec FR-5): thematic pair replaces rotation.
        let eventOverride: Record<string, unknown> | null = null;
        const th = hijriFromGregorian(
          nowD.getUTCFullYear(),
          nowD.getUTCMonth() + 1,
          nowD.getUTCDate(),
        );
        const todaysEvent = eventForHijri(th.month, th.day);
        if (todaysEvent) {
          const ref = EVENT_CONTENT[todaysEvent.id];
          eventOverride = {
            event_id: todaysEvent.id,
            ayah: (ref ? resolveAyahRef(ref) : null) ?? {
              surah_id: ref?.surah_id ?? 1,
              ayah_number: ref?.ayah_number ?? 1,
            },
            hadith: {
              id: `hevent-fixture-${todaysEvent.id}`,
              arabic: '(e2e fixture)',
              en: `Fixture hadith for ${todaysEvent.id}.`,
              id_translation: `Hadis fixture untuk ${todaysEvent.id}.`,
              source: `E2E fixture · ${todaysEvent.id}`,
            },
          };
        }
        return {
          date: dateStr,
          ayah: ayahResolved,
          hadith,
          ...(eventOverride ? { event: eventOverride } : {}),
        };
      }
      function prayerLogEntries(from: string, to: string) {
        return prayerLog.filter((e) => e.date >= from && e.date <= to);
      }
      function logPrayer(prayer: string, date: string) {
        const p = String(prayer).toLowerCase();
        const valid = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        if (!valid.includes(p)) throw new Error(`unknown prayer ${prayer}`);
        const entry = { date, prayer: p, status: 'on_time', logged_at: new Date().toISOString() };
        const idx = prayerLog.findIndex((e) => e.date === date && e.prayer === p);
        if (idx >= 0) prayerLog[idx] = entry;
        else prayerLog.push(entry);
        persist();
        return entry;
      }

      const mockInvoke = async (cmd: string, args: Record<string, unknown> = {}) => {
        // Generic plugin handlers — prevent "mock missing" for event/notification/window plugins.
        // NOTE: Hijri mock below is TEST-ONLY 30/29 alternation — not canonical ICU4X; anchors verified only.
        if (cmd.startsWith('plugin:')) {
          if (cmd.includes('event')) {
            // Real listen/unlisten wiring so emitted events reach JS handlers
            // (AdhanPlayer / PrayerPrompt register via @tauri-apps/api/event).
            if (cmd.endsWith('|listen')) {
              const id = nextListenerId++;
              eventListeners.set(id, {
                event: String(args.event ?? ''),
                handlerKey: String(args.handler),
              });
              // Observable registration count for E2E race-free waits.
              (window as unknown as Record<string, unknown>).__TAURI_EVENT_LISTENERS__ =
                eventListeners.size;
              return id;
            }
            if (cmd.endsWith('|unlisten')) {
              eventListeners.delete(Number(args.eventId));
              (window as unknown as Record<string, unknown>).__TAURI_EVENT_LISTENERS__ =
                eventListeners.size;
              return null;
            }
            return null;
          }
          if (cmd.startsWith('plugin:window')) return { label: 'main' };
          return null;
        }
        switch (cmd) {
          case 'get_setting':
            return settings.get(String(args.key)) ?? null;
          case 'set_setting':
            settings.set(String(args.key), String(args.value));
            persist();
            return null;
          case 'db_status':
            return { path: '/tmp/mock/rafiq.db', version: 3 };
          case 'get_prayer_times':
            return prayerTimesFor(
              String(args.date),
              args.coordinates as { latitude: number; longitude: number },
            );
          case 'get_location':
            return location;
          case 'set_location': {
            const loc = args.location as {
              city_id?: string | null;
              latitude?: number | null;
              longitude?: number | null;
            };
            if (loc?.city_id) {
              const city = findCityById(loc.city_id);
              if (!city) throw new Error(`city not found: ${loc.city_id}`);
              location = { city_id: loc.city_id, latitude: null, longitude: null };
            } else if (loc?.latitude !== null && loc?.longitude !== null) {
              location = {
                city_id: null,
                latitude: loc.latitude as number,
                longitude: loc.longitude as number,
              };
            } else throw new Error('no location provided');
            persist();
            return null;
          }
          case 'search_cities':
            return searchCities(String(args.query ?? ''), args.limit as number | null);
          case 'get_city_by_id': {
            const city = findCityById(String(args.cityId));
            return city ?? null;
          }
          case 'get_resolved_location':
            return resolveLocation();
          case 'get_next_prayer':
            return null;
          case 'trigger_test_prayer': {
            const p = String(args.prayer ?? 'fajr').toLowerCase();
            const time = new Date().toISOString();
            try {
              window.dispatchEvent(new CustomEvent('prayer-time', { detail: { prayer: p } }));
            } catch {}
            // Real Tauri-event delivery so AdhanPlayer/PrayerPrompt react.
            emitTauriEvent('prayer-fired', { prayer: p, time });
            emitTauriEvent('prayer-time', { prayer: p, time });
            try {
              let el = document.getElementById('mock-prayer-prompt');
              if (!el) {
                el = document.createElement('div');
                el.id = 'mock-prayer-prompt';
                el.setAttribute('role', 'dialog');
                el.style.position = 'fixed';
                el.style.bottom = '1rem';
                el.style.left = '50%';
                el.style.transform = 'translateX(-50%)';
                el.style.padding = '1rem';
                el.style.background = 'white';
                el.style.border = '1px solid #e5e7eb';
                el.style.zIndex = '9999';
                document.body.appendChild(el);
              }
              el.textContent = `Prayer: ${p}`;
              el.dataset.prayer = p;
            } catch {}
            return { prayer: p, time: new Date().toISOString() };
          }
          case 'reschedule_prayer_notifications':
            return null;
          case 'hijri_from_gregorian':
            return hijriFromGregorian(Number(args.year), Number(args.month), Number(args.day));
          case 'hijri_to_gregorian':
            return hijriToGregorian(Number(args.year), Number(args.month), Number(args.day));
          case 'hijri_month_grid':
            return getMonthGrid(Number(args.year), Number(args.month));
          case 'today_hijri': {
            const d = mockToday();
            return hijriFromGregorian(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
          }
          case 'get_upcoming_hijri_events': {
            const limit = Math.max(0, Number(args.limit ?? 3));
            if (!limit) return [];
            const base = mockToday();
            const out: Array<{
              id: string;
              hijri_year: number;
              gregorian_date: string;
              is_today: boolean;
              estimated: boolean;
            }> = [];
            for (let offset = 0; offset <= 370 && out.length < limit; offset++) {
              const d = new Date(base.getTime() + offset * 86_400_000);
              const h = hijriFromGregorian(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
              const ev = eventForHijri(h.month, h.day);
              if (!ev) continue;
              if (out.some((u) => u.id === ev.id)) continue;
              out.push({
                id: ev.id,
                hijri_year: h.year,
                gregorian_date: d.toISOString().slice(0, 10),
                is_today: offset === 0,
                estimated: ev.estimated,
              });
            }
            return out;
          }
          case 'list_surahs':
            return listSurahs();
          case 'get_surah':
            return getSurah(Number(args.id));
          case 'search_surahs':
            return searchSurahs(String(args.query ?? ''), args.limit as number | null);
          case 'get_quran_translation':
            return quranTranslation;
          case 'set_quran_translation': {
            const t = String(args.translation ?? '')
              .trim()
              .toLowerCase();
            if (!['sahih', 'clear', 'kemenag'].includes(t))
              throw new Error(`unknown translation ${args.translation}`);
            quranTranslation = t;
            persist();
            return null;
          }
          case 'get_daily_content':
            return getDailyContent();
          case 'log_prayer':
            return logPrayer(String(args.prayer), String(args.date));
          case 'delete_log_entry': {
            const idx = prayerLog.findIndex(
              (e) => e.date === String(args.date) && e.prayer === String(args.prayer).toLowerCase(),
            );
            if (idx >= 0) {
              prayerLog.splice(idx, 1);
              persist();
            }
            return null;
          }
          case 'get_prayer_log':
            return prayerLogEntries(String(args.from), String(args.to));
          case 'get_log_analytics': {
            const todayStr = new Date().toISOString().slice(0, 10);
            const hasToday = prayerLog.some((e) => e.date === todayStr);
            return {
              streaks: { current: hasToday ? 1 : 0, best: hasToday ? 1 : 0 },
              month: {
                completion_pct: hasToday ? 20 : 0,
                on_time_pct: hasToday ? 20 : 0,
                qada_pct: 0,
                missed_pct: hasToday ? 80 : 100,
              },
            };
          }
          case 'fetch_ayah_audio': {
            // Frontend sends camelCase args ({globalAyah}); Tauri's snake_case
            // conversion only happens at the real Rust boundary.
            const ayah = Number(args.globalAyah);
            // Cache hit: serve from the index without any network semantics.
            const cachedEntry = recitationIndex.get(ayah);
            if (cachedEntry) {
              return { ...cachedEntry };
            }
            // Al-Fatiha occupies globals 1..7; serve them plus the first
            // ayahs of Al-Baqarah (8..10) from local fixture paths so the
            // auto-advance lookahead after the Fatiha→Baqarah boundary
            // succeeds without any network. Bytes come from the page.route
            // fulfiller in recitation.spec.ts (no real CDN).
            if (ayah >= 1 && ayah <= 10) {
              const entry = {
                global_ayah: ayah,
                file_path: `/tmp/mock/recitation/${ayah}.mp3`,
                size_bytes: 8192,
              };
              recitationIndex.set(ayah, entry);
              return { ...entry };
            }
            throw new Error('network disabled in mock — only globals 1..10 mocked');
          }
          case 'get_recitation_state': {
            // Complete RecitationState so RecitationPlayButton/Footer enable;
            // `reciter.name` must be present (missing it crashed the footer).
            const sid = Number(args.surahId);
            const surah = getSurah(sid) as { id: number; ayahs?: unknown[] } | undefined;
            if (!surah) {
              throw new Error(`surah not found: ${sid}`);
            }
            const count = Array.isArray(surah.ayahs) ? surah.ayahs.length : 0;
            let firstGlobal = 1;
            for (const s of listSurahs() as Array<{ id: number; ayahs?: unknown[] }>) {
              if (s.id === sid) {
                break;
              }
              firstGlobal += Array.isArray(s.ayahs) ? s.ayahs.length : 0;
            }
            const lastGlobal = firstGlobal + count - 1;
            const cached = [...recitationIndex.values()]
              .filter((c) => c.global_ayah >= firstGlobal && c.global_ayah <= lastGlobal)
              .map(({ global_ayah, file_path }) => ({ global_ayah, file_path }));
            return {
              surah_id: sid,
              ayah_count: count,
              first_global_ayah: firstGlobal,
              cached,
              last_played_ayah: lastPlayed?.surahId === sid ? lastPlayed.ayah : null,
              reciter: { name: 'E2E Reciter', edition: 'ara.alafasy' },
            };
          }
          case 'report_played_position':
            lastPlayed = { surahId: Number(args.surahId), ayah: Number(args.ayah) };
            return null;
          default:
            throw new Error(`mock missing for Tauri command: ${cmd}`);
        }
      };

      const callbacks: Record<string, (arg: unknown) => void> = {};

      /** Deliver a Tauri event to registered JS `listen()` handlers. */
      function emitTauriEvent(event: string, payload: unknown) {
        const w = window as unknown as {
          __TAURI_EVENT_HITS__?: Record<string, number>;
          __TAURI_EVENT_ERRORS__?: string[];
        };
        w.__TAURI_EVENT_HITS__ ??= {};
        w.__TAURI_EVENT_ERRORS__ ??= [];
        for (const listener of [...eventListeners.values()]) {
          if (listener.event !== event) continue;
          const cb = callbacks[listener.handlerKey];
          if (!cb) continue;
          try {
            cb({ event, id: Number(listener.handlerKey), payload });
            w.__TAURI_EVENT_HITS__[event] = (w.__TAURI_EVENT_HITS__[event] ?? 0) + 1;
          } catch (err) {
            w.__TAURI_EVENT_ERRORS__.push(
              `${event}: ${(err instanceof Error ? err.message : String(err)).slice(0, 200)}`,
            );
          }
        }
      }

      const internals = {
        invoke: mockInvoke,
        // The mock installs __TAURI_INTERNALS__, so `isTauri()` is true and
        // `localAudioUrl()` routes through convertFileSrc. Tauri v2 delegates
        // that to this internals method; return the path as-is (mirroring the
        // library's plain-browser branch) so <audio> URLs stay relative and
        // interceptable by Playwright routes (/tmp/mock/recitation/N.mp3).
        convertFileSrc: (path: string) => path,
        transformCallback: (cb: (arg: unknown) => void) => {
          const id = String(Math.floor(Math.random() * 1_000_000));
          callbacks[id] = cb;
          // Expose for manual trigger if needed
          (window as unknown as Record<string, unknown>).__TAURI_CALLBACKS__ = callbacks;
          return Number(id);
        },
        unregisterCallback: (id: number) => {
          delete callbacks[String(id)];
        },
      };

      const mockTauri = {
        core: { invoke: mockInvoke },
        invoke: mockInvoke,
        event: {
          listen: async (_event: string, handler: (e: unknown) => void) => {
            // Mock: store handler, return unlisten; trigger via window dispatch if needed
            const id = internals.transformCallback(handler as unknown as (arg: unknown) => void);
            return () => internals.unregisterCallback(id);
          },
          emit: async () => {},
        },
      };
      // @ts-expect-error
      window.__TAURI__ = mockTauri as unknown as Window['__TAURI__'];
      // @ts-expect-error
      window.__TAURI_INTERNALS__ = internals as unknown as never;
      try {
        // @ts-expect-error
        window.__TAURI_IPC__ = (message: unknown) =>
          mockInvoke(
            (message as { cmd: string }).cmd,
            message as { args: unknown } as Record<string, unknown>,
          );
      } catch {}
    },
    {
      quranJson: quranPayload,
      citiesJson: citiesPayload,
      ayahsJson: ayahsPayload,
      hadithsJson: hadithsPayload,
    },
  );
}
