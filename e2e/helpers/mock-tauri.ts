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
      const DAILY_HADITHS: Array<unknown> = hadithsJson ? JSON.parse(hadithsJson as string) : [];

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
        if (location?.latitude !== null && location?.longitude !== null) {
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
        let hYear = 1448;
        let hMonth = 1;
        let hDay = 1 + deltaDays;
        while (hDay > 30) {
          const daysInMonth = hMonth % 2 === 1 ? 30 : 29;
          if (hDay > daysInMonth) {
            hDay -= daysInMonth;
            hMonth += 1;
            if (hMonth > 12) {
              hMonth = 1;
              hYear += 1;
            }
          } else break;
        }
        while (hDay < 1) {
          hMonth -= 1;
          if (hMonth < 1) {
            hMonth = 12;
            hYear -= 1;
          }
          const daysInMonth = hMonth % 2 === 1 ? 30 : 29;
          hDay += daysInMonth;
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
        const today = hijriFromGregorian(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth() + 1,
          new Date().getUTCDate(),
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
        }> = [];
        for (let i = 1; i <= dayCount; i++) {
          const isToday = today.year === year && today.month === month && today.day === i;
          const gregDay = firstGreg.day + (i - 1);
          let gYear = firstGreg.year;
          let gMonth = firstGreg.month;
          let gDay = gregDay;
          while (gDay > 30) {
            gDay -= 30;
            gMonth += 1;
            if (gMonth > 12) {
              gMonth = 1;
              gYear += 1;
            }
          }
          days.push({
            hijri_day: i,
            gregorian_year: gYear,
            gregorian_month: gMonth,
            gregorian_day: gDay,
            weekday: (firstGreg.weekday + (i - 1)) % 7,
            is_today: isToday,
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
      function getDailyContent() {
        const lenAyah = DAILY_AYAHS.length || 1;
        const lenHadith = DAILY_HADITHS.length || 1;
        const start = Date.UTC(2026, 0, 1);
        const now = Date.now();
        const days = Math.floor((now - start) / 86_400_000);
        const ayahRef = DAILY_AYAHS[((days % lenAyah) + lenAyah) % lenAyah];
        const hadith = DAILY_HADITHS[((days % lenHadith) + lenHadith) % lenHadith];
        const dateStr = new Date().toISOString().slice(0, 10);
        let ayahResolved: unknown = ayahRef;
        if (
          ayahRef &&
          typeof ayahRef === 'object' &&
          'surah_id' in (ayahRef as Record<string, unknown>)
        ) {
          const sid = (ayahRef as { surah_id: number }).surah_id;
          const anum = (ayahRef as { ayah_number: number }).ayah_number;
          try {
            const surah = getSurah(sid) as {
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
            const ayah = surah.ayahs.find((a) => a.number === anum);
            if (ayah) {
              const tKey = (quranTranslation as string).toLowerCase() as
                | 'sahih'
                | 'clear'
                | 'kemenag';
              const translation = (ayah as Record<string, string>)[tKey] ?? ayah.sahih;
              ayahResolved = {
                id: (ayahRef as { id?: string }).id ?? `${sid}:${anum}`,
                surah_id: sid,
                ayah_number: anum,
                arabic: ayah.arabic,
                translation,
                surah_name_en: surah.name_en,
                surah_name_ar: surah.name_ar,
              };
            }
          } catch {}
        }
        return { date: dateStr, ayah: ayahResolved, hadith };
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
          if (cmd.includes('event')) return cmd.includes('listen') ? 1 : null;
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
            try {
              window.dispatchEvent(new CustomEvent('prayer-time', { detail: { prayer: p } }));
            } catch {}
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
          case 'today_hijri':
            return hijriFromGregorian(
              new Date().getUTCFullYear(),
              new Date().getUTCMonth() + 1,
              new Date().getUTCDate(),
            );
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
            const ayah = Number(args.global_ayah);
            if (ayah === 1) {
              const key = 1;
              recitationIndex.set(key, {
                global_ayah: key,
                file_path: '/tmp/mock/recitation/1.mp3',
                size_bytes: 8192,
              });
              return {
                global_ayah: key,
                file_path: '/tmp/mock/recitation/1.mp3',
                size_bytes: 8192,
              };
            }
            throw new Error('network disabled in mock — only ayah 1 mocked');
          }
          case 'get_recitation_state':
            // Frontend expects null when no active playback; returning an object with missing reciter would crash RecitationFooter (reciter.name)
            return null;
          case 'report_played_position':
            return null;
          default:
            throw new Error(`mock missing for Tauri command: ${cmd}`);
        }
      };

      const callbacks: Record<string, (arg: unknown) => void> = {};
      const internals = {
        invoke: mockInvoke,
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
