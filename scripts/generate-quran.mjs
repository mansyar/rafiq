#!/usr/bin/env node
// Generate bundled Quran dataset for Rafiq — CC BY / free translations.
// Fetches from alquran.cloud (Tanzil-derived Uthmani + translations).
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const QURAN_DIR = path.resolve(import.meta.dirname, '../src-tauri/assets/quran');
const OUT_JSON = path.join(QURAN_DIR, 'quran.json');
const OUT_ATTRIB = path.join(QURAN_DIR, 'ATTRIBUTION.md');

const ENDPOINTS = {
  uthmani: 'https://api.alquran.cloud/v1/quran/quran-uthmani',
  sahih: 'https://api.alquran.cloud/v1/quran/en.sahih',
  clear: 'https://api.alquran.cloud/v1/quran/en.itani',
  kemenag: 'https://api.alquran.cloud/v1/quran/id.indonesian',
};

async function fetchJson(url) {
  console.log(`Fetching ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  const j = await res.json();
  if (j.code !== 200) throw new Error(`API ${url} code ${j.code}`);
  return j.data;
}

async function main() {
  const [uthmani, sahih, clear, kemenag] = await Promise.all([
    fetchJson(ENDPOINTS.uthmani),
    fetchJson(ENDPOINTS.sahih),
    fetchJson(ENDPOINTS.clear),
    fetchJson(ENDPOINTS.kemenag),
  ]);

  // uthmani.data.surahs etc. For /quran/*, data has .surahs
  const sU = uthmani.surahs;
  const sS = sahih.surahs;
  const sC = clear.surahs;
  const sK = kemenag.surahs;

  if (sU.length !== 114 || sS.length !== 114 || sC.length !== 114 || sK.length !== 114) {
    throw new Error(`Expected 114 surahs each, got ${sU.length}/${sS.length}/${sC.length}/${sK.length}`);
  }

  const surahs = [];
  let totalAyahs = 0;
  for (let i = 0; i < 114; i++) {
    const u = sU[i];
    const s = sS[i];
    const c = sC[i];
    const k = sK[i];
    if (u.number !== s.number || u.number !== c.number || u.number !== k.number) {
      throw new Error(`surah number mismatch at index ${i}`);
    }
    if (u.ayahs.length !== s.ayahs.length || u.ayahs.length !== c.ayahs.length || u.ayahs.length !== k.ayahs.length) {
      throw new Error(`ayah count mismatch surah ${u.number}: ${u.ayahs.length}/${s.ayahs.length}/${c.ayahs.length}/${k.ayahs.length}`);
    }
    const ayahs = u.ayahs.map((ua, idx) => ({
      number: ua.numberInSurah,
      arabic: ua.text.replace(/^\uFEFF/, ''),
      sahih: s.ayahs[idx].text,
      clear: c.ayahs[idx].text,
      kemenag: k.ayahs[idx].text,
    }));
    totalAyahs += ayahs.length;
    surahs.push({
      id: u.number,
      name_ar: u.name,
      name_transliteration: u.englishName,
      name_en: u.englishName,
      name_id: u.englishName, // Indonesian transliteration same; full id locale uses transliteration + translation
      ayah_count: ayahs.length,
      revelation_type: u.revelationType, // Meccan/Medinan
      ayahs,
    });
  }

  if (totalAyahs !== 6236) {
    throw new Error(`Expected 6236 ayahs, got ${totalAyahs}`);
  }

  const out = { surahs };
  await mkdir(QURAN_DIR, { recursive: true });
  await writeFile(OUT_JSON, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote ${OUT_JSON}: ${surahs.length} surahs, ${totalAyahs} ayahs, ${Buffer.byteLength(JSON.stringify(out))} bytes`);

  // Attribution — verify licenses
  const attrib = `# Quran Assets — Attribution

Bundled Quran text and translations for Rafiq — offline-first, verified licenses.

- **Arabic (Uthmani):** Tanzil Project — Quran Uthmani text via alquran.cloud (derived from Tanzil.net, CC BY 3.0 / Tanzil terms). Edition \`quran-uthmani\`.
- **English — Sahih International:** Saheeh International translation (\`en.sahih\`) — free for non-commercial distribution, via alquran.cloud.
- **English — The Clear Quran:** Talal Itani — Clear Quran (\`en.itani\`) — courtesy of TheClearQuran.org, free distribution.
- **Indonesian — Bahasa Indonesia:** Indonesian Ministry of Religious Affairs / Unknown translator via alquran.cloud (\`id.indonesian\`) — free distribution.

Sources fetched ${new Date().toISOString().slice(0, 10)} from https://api.alquran.cloud/v1/quran/{quran-uthmani,en.sahih,en.itani,id.indonesian}.
Tanzil original: http://tanzil.net/trans/ — Uthmani text.
If any translation license requires explicit permission for bundled distribution, replace with a clearly free alternative before release.

Data shape: \`quran.json\` — \`{ surahs: Surah[] }\` where Surah ayahs include arabic + sahih/clear/kemenag.
`;
  await writeFile(OUT_ATTRIB, attrib, 'utf8');
  console.log(`Wrote ${OUT_ATTRIB}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
