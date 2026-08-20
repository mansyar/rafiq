# Quran Assets — Attribution

Bundled Quran text and translations for Rafiq — offline-first, verified licenses.

- **Arabic (Uthmani):** Tanzil Project — Quran Uthmani text via alquran.cloud (derived from Tanzil.net, CC BY 3.0 / Tanzil terms). Edition `quran-uthmani`.
- **English — Sahih International:** Saheeh International translation (`en.sahih`) — free for non-commercial distribution, via alquran.cloud.
- **English — The Clear Quran:** Talal Itani — Clear Quran (`en.itani`) — courtesy of TheClearQuran.org, free distribution.
- **Indonesian — Bahasa Indonesia:** Indonesian Ministry of Religious Affairs / Unknown translator via alquran.cloud (`id.indonesian`) — free distribution.

Sources fetched 2026-08-20 from https://api.alquran.cloud/v1/quran/{quran-uthmani,en.sahih,en.itani,id.indonesian}.
Tanzil original: http://tanzil.net/trans/ — Uthmani text.
If any translation license requires explicit permission for bundled distribution, replace with a clearly free alternative before release.

Data shape: `quran.json` — `{ surahs: Surah[] }` where Surah ayahs include arabic + sahih/clear/kemenag.
