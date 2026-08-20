# Audio Attribution — Adhan

## `adhan.mp3`
- **Content:** Full adhan (call to prayer) — close-range field recording from a mosque in Alanya, Turkey (recorded from a hotel balcony right next to the mosque, Sony PCM-M10, March 2023). The adhan itself runs ~1:06; the file ends with a short natural silence.
- **Source:** ["Minaret"](https://freesound.org/people/AugustSandberg/sounds/677581/) by **AugustSandberg** on [Freesound](https://freesound.org/) (retrieved 2026-08-20).
- **License:** [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) — dedicated to the public domain by the author ("All my sounds are dedicated to the public domain, and are free to use, no restrictions"). **Satisfies Rafiq's verified CC0/public-domain policy** (see `conductor/product.md`).
- **SHA-256:** `D7CD053600CC511CA4D13F3229D23F22C616C3CD549B5D7B32760E99719B7D95`
- **File:** `src/assets/audio/adhan.mp3` (333,974 bytes / 326 KiB, MP3 VBR ~37 kbps, 44.1 kHz mono, 72.7 s, ID3v2.3 tags with source attribution).
- **Derivation:** Re-encoded from the Freesound HQ preview (184 kbps MP3 of the original 48 kHz/24-bit WAV) with `libmp3lame -q:a 8` mono; no content trimmed.

> CC0 requires no attribution — provided here anyway per project practice.

## Changelog
- **2026-08-20** — Replaced the unlicensed "Athan Makkah" recording (no license granted by its source repo) with the CC0 "Minaret" adhan above. This closes the original pre-release TODO (verified CC0/PD adhan, <500 KiB).
- **2026-08-20** — (superseded) Swapped the synthetic 4 s sine-wave placeholder for an "Athan Makkah" recording from [abodehq/Athan-MP3](https://github.com/abodehq/Athan-MP3). That source repo grants **no license** (all rights reserved by default), so it was not retained.
