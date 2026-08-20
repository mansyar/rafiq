# City Dataset Attribution — Rafiq

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
