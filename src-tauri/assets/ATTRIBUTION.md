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
- **Compliance:** Rafiq fetches only on explicit user action (streaming/download for personal use), attributes the reciter in the in-app player, and does not redistribute the files. In any commercial distribution the reciter may request removal; the recitation edition is a single configurable constant so an alternative edition can be substituted if ever required (see `conductor/tech-stack.md`).
