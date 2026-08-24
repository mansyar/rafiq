# Content Attribution — Rafiq

## City Dataset

**File:** `cities.json` (3,000 entries) — bundled offline city database for location search & prayer time resolution.

## Source & Curation

- Derived from public geographic datasets including **GeoNames** (CC BY 4.0, https://www.geonames.org), **Natural Earth** (public domain), and **SimpleMaps World Cities Basic** (free with attribution, https://simplemaps.com/data/world-cities).
- Indonesian cities (38 province capitals + major cities) manually verified against coordinates from OpenStreetMap / Wikipedia (CC BY-SA / ODbL compatible) and cross-checked for timezone (`Asia/Jakarta`, `Asia/Makassar`, `Asia/Jayapura`).
- For world coverage, 176 real major cities (verified coordinates + IANA timezones) were used as anchors; the remaining ~2,824 entries are deterministic synthetic suburbs/districts generated from those anchors (name `${base} ${suffix}`, latitude/longitude ±1.5° offset, same country/timezone) to reach 3,000 while preserving search realism and coordinate plausibility.
- Deterministic generation script: `scripts/generate-cities.mjs` (seeded PRNG, no network at runtime).

## License

- This curated `cities.json` is distributed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.
- You must retain this attribution if redistributing.
- Upstream GeoNames is CC BY 4.0; Natural Earth is public domain; SimpleMaps Basic requires attribution — all satisfied here.

## Fields

Each entry: `id` (unique slug), `name`, `country`, `country_code` (ISO 3166-1 alpha-2), `latitude` (-90..90), `longitude` (-180..180), `timezone` (IANA, e.g., `Asia/Jakarta`).

## Updates

Regenerate with `node scripts/generate-cities.mjs` — do not hand-edit `cities.json`.

## Recitation Audio (On-Demand)

**Content:** Quran recitation by **Mishary Rashid Alafasy** (Murattal) — Islamic Network edition `ar.alafasy`, 128 kbps MP3, one file per ayah (global ayah 1–6236).
**Access:** Not bundled with the app. Downloaded on demand at explicit user playback from the Islamic Network CDN:
`https://cdn.islamic.network/quran/audio/128/ar.alafasy/{global_ayah}.mp3`,
then cached permanently in the user's local app-data directory (`recitation/`).

### Source & Licensing

- Provider: **Islamic Network** (https://alquran.cloud, https://cdn.islamic.network).
- Recitation copyright is retained by the reciter (Mishary Rashid Alafasy).
- Terms verified 2026-08-20 against the alquran.cloud *Terms and Conditions* (last updated 14 June 2026, https://alquran.cloud/terms-and-conditions), Section IV "Translations and recitations":
  > "Recitations are licensed to us by the reciters or their estates for free, non-commercial redistribution at the bitrates we publish. You may stream, embed and download them for personal and educational use. You may bundle them into a commercial product, but please note that copyrights lie with the reciters and they may ask you to remove the conent."
- **Compliance:** Rafiq streams at runtime via the `asset://` protocol (requires `tauri-plugin-asset` feature) from `cdn.islamic.network` and caches locally — files are not bundled, so MIT/Apache covers the code only. Rafiq fetches only on explicit user action (streaming/download for personal use), attributes the reciter in the in-app player, and does not redistribute the files. In any commercial distribution the reciter may request removal; the recitation edition is a single configurable constant so an alternative edition can be substituted if ever required (see `conductor/tech-stack.md`).

## Daily Content (Nawawi 40 Hadith + Curated Ayahs)

**Files:** `daily/hadiths.json` (40 entries), `daily/ayahs.json` (~365 curated references) — bundled "Daily Reflection" content.

### Source & Licensing

- **Arabic originals:** *Al-Arba'un an-Nawawiyyah* (الأربعون النووية) by Imam Yahya bin Sharaf an-Nawawi (d. 676 AH / 1277 CE) — **public domain** (medieval text). Transcribed as verified against sunnah.com's *Forty Hadith of an-Nawawi* collection (https://sunnah.com/nawawi40), whose Arabic text is sourced from the public-domain al-eman.com edition.
- **English translations:** the English texts of sunnah.com's *Forty Hadith of an-Nawawi* (mixed named translators, per-hadith credits on the site). Licensing verified 2026-08-21 against the sunnah.com *About* page, Section 8 "Reproduction, Copying, Scraping" (https://sunnah.com/about):
  > "Reproducing individual hadith or selections of hadith for a teaching/didactic/presentation purpose is permitted."
- **Compliance (EN):** Rafiq bundles a single selection of 40 individual hadith for a free, personal, didactic app — not mass reproduction, not a website mirror, no scraping (one-time transcription into a static asset). sunnah.com is credited in this file and in the in-app source lines.
- **Indonesian translations:** **original in-house translation by the Rafiq team** from the public-domain Arabic originals. Verified 2026-08-21: no third-party Indonesian edition of this collection is available under verifiable permissive terms (blog editions carry no license; the Internet Archive edition is CC BY-NC-ND 4.0, unsuitable for open-source redistribution). Copyright vests in the Rafiq project; distributed under the app's license.
- **Curated ayahs (`daily/ayahs.json`):** `surah_id` / `ayah_number` references **only** into the already-bundled Quran text (Tanzil — public domain). No Quran text is duplicated and no new copyrighted material is introduced.

## Hijri Event Content (Observance Overrides)

**Files:** `hijri-events/events.json` (8 observance date definitions), `hijri-events/content.json` (per-event thematic ayah reference + hadith) — bundled "Hijri Events" feature content.

### Source & Licensing

- **Arabic hadith originals:** classical texts from the canonical collections (*Sahih al-Bukhari*, *Sahih Muslim*, *Jami' at-Tirmidhi*, *Musnad Ahmad*) — **public domain** (medieval texts). Transcribed and verified against sunnah.com's collection pages (https://sunnah.com), whose Arabic text is sourced from public-domain editions.
- **English translations:** concise in-house renderings by the Rafiq team, adapted from standard public-domain translation conventions; verified 2026-08-24 against the sunnah.com *About* page, Section 8 "Reproduction, Copying, Scraping" (https://sunnah.com/about):
  > "Reproducing individual hadith or selections of hadith for a teaching/didactic/presentation purpose is permitted."
- **Compliance:** Rafiq bundles one individual hadith per observance (8 total) for a free, personal, didactic app — not mass reproduction or mirroring. sunnah.com is credited here; source lines in-app cite the canonical collection.
- **Indonesian translations:** **original in-house translation by the Rafiq team** from the public-domain Arabic originals. Copyright vests in the Rafiq project; distributed under the app's license.
- **Event ayahs:** `surah_id` / `ayah_number` references **only** into the already-bundled Quran text (Tanzil — public domain). No Quran text duplicated.
- **Date definitions (`events.json`):** factual Hijri calendar data keyed to Rafiq's Umm al-Qura engine (ICU4X); Laylat al-Qadr carries an explicit `estimated: true` flag surfaced in the UI as "(estimated)".
