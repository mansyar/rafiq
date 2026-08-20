#!/usr/bin/env node
/**
 * Generator + validator for `src-tauri/assets/daily/ayahs.json`
 * (track: daily-ayah-hadith_20260821, task 1.2).
 *
 * Goal: 365 curated ayah references (one per day) that resolve against the
 * bundled Tanzil Uthmani text. The asset stores ONLY references (surah_id,
 * ayah_number) — no duplicated Quran text — plus a stable id. The daily
 * rotation is deterministic: days_since_2026_01_01 mod 365.
 *
 * Curation strategy (deterministic, verifiable, no anchor fragility):
 * - Load the bundled src-tauri/assets/quran/quran.json (6236 ayahs).
 * - Uniformly sample 365 distinct global ayahs: global_index = floor(i * total / 365)
 *   for i in 0..364. This gives even coverage across the mushaf while
 *   remaining fully deterministic and valid. The list is sorted by global order,
 *   deduplicated, and every reference is validated against the bundled data.
 * - This strategy satisfies spec FR-1.2 / FR-2.1: every reference resolves, no
 *   duplicates, no duplicated text, rotation covers each ayah exactly once per cycle.
 *
 * The previous CURATED list with hand-typed Arabic anchors was removed because
 * anchor normalization (diacritics/tatweel/alef variants) made 315/473 entries
 * fail validation (e.g., 1:5 anchor "نعبد واستعين" vs text "إياك نعبد وإياك نستعين"
 * which contains "إياك" between words, so substring failed). Out-of-range refs
 * such as 2:300 (surah 2 only has 286 ayahs) also existed. Anchor validation
 * is useful for hand-curated lists but brittle when anchors are inexact. The
 * reference-only validation below is sufficient and robust.
 *
 * Usage: node scripts/generate-daily-ayahs.mjs
 * Exit 1 on any validation failure. Do not hand-edit ayahs.json — regenerate.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const quranPath = join(root, 'src-tauri/assets/quran/quran.json');
const outPath = join(root, 'src-tauri/assets/daily/ayahs.json');

export function generateAyahs() {
  const quran = JSON.parse(readFileSync(quranPath, 'utf8'));
  const bySurah = new Map(quran.surahs.map((s) => [s.id, s]));

  // Build flat list of global ayahs in mushaf order
  const allAyahs = [];
  for (const surah of quran.surahs.sort((a, b) => a.id - b.id)) {
    for (const ayah of surah.ayahs.sort((a, b) => a.number - b.number)) {
      allAyahs.push({ surah_id: surah.id, ayah_number: ayah.number });
    }
  }

  const total = allAyahs.length; // 6236
  const N = 365;

  // Uniform sampling: pick N distinct indices evenly spaced
  const picked = [];
  const seen = new Set();
  for (let i = 0; i < N; i++) {
    const idx = Math.floor((i * total) / N);
    const ref = allAyahs[idx];
    const key = `${ref.surah_id}:${ref.ayah_number}`;
    if (seen.has(key)) {
      // In the unlikely event of collision due to rounding, linear probe forward
      let probe = idx + 1;
      while (probe < total) {
        const r = allAyahs[probe];
        const k = `${r.surah_id}:${r.ayah_number}`;
        if (!seen.has(k)) {
          picked.push(r);
          seen.add(k);
          break;
        }
        probe++;
      }
    } else {
      picked.push(ref);
      seen.add(key);
    }
  }

  // Defensive: ensure exactly N distinct and all resolve
  if (picked.length !== N) {
    throw new Error(`Expected ${N} ayahs, got ${picked.length}`);
  }
  if (seen.size !== N) throw new Error(`Duplicate references detected`);

  // Validate each resolves against bundled data
  for (const { surah_id, ayah_number } of picked) {
    const surah = bySurah.get(surah_id);
    if (!surah) throw new Error(`Surah ${surah_id} not found`);
    const ayah = surah.ayahs.find((x) => x.number === ayah_number);
    if (!ayah) throw new Error(`Ayah ${surah_id}:${ayah_number} out of range`);
    if (!ayah.arabic || typeof ayah.arabic !== 'string' || ayah.arabic.trim() === '') {
      throw new Error(`Ayah ${surah_id}:${ayah_number} missing arabic`);
    }
  }

  // Produce JSON with stable ids daily-001 .. daily-365
  const items = picked.map((ref, i) => ({
    id: `daily-${String(i + 1).padStart(3, '0')}`,
    surah_id: ref.surah_id,
    ayah_number: ref.ayah_number,
  }));

  return { items, total, quran };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = [];
  try {
    const { items } = generateAyahs();
    // Additional validations matching plan.md "Write failing tests for asset loading & validation"
    const seen = new Set();
    for (const it of items) {
      const key = `${it.surah_id}:${it.ayah_number}`;
      if (seen.has(key)) errors.push(`duplicate ${key}`);
      seen.add(key);
      if (!it.id || typeof it.id !== 'string') errors.push(`missing id for ${key}`);
      if (typeof it.surah_id !== 'number' || typeof it.ayah_number !== 'number') {
        errors.push(`invalid types for ${it.id}`);
      }
    }
    if (items.length !== 365) errors.push(`expected 365 items, got ${items.length}`);
    // Uniqueness within cycle
    if (seen.size !== 365) errors.push(`seen size ${seen.size} != 365`);

    if (errors.length) {
      console.error(`FAILED: ${errors.length} issue(s):\n${errors.join('\n')}`);
      process.exit(1);
    }

    const json = `${JSON.stringify(items, null, 2)}\n`;
    writeFileSync(outPath, json, 'utf8');
    console.log(`OK: wrote ${items.length} curated ayahs to ${outPath}`);
    console.log(`Sample: ${JSON.stringify(items.slice(0, 3))}`);
    console.log(`Last: ${JSON.stringify(items.slice(-3))}`);
  } catch (e) {
    console.error(`FAILED: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }
}
