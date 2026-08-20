# Audio Attribution — Adhan

## `adhan.mp3`
- **Content:** Full adhan (call to prayer) — professional field recording in Amman, Jordan (Rode NTG3 shotgun microphone into a Sound Devices 664 mixer, recorded on location Sept 2020). Continuous ~4:07 adhan, ending with a short natural silence.
- **Source:** ["Muslim Adan (Call For Prayer) Amman Jordan"](https://freesound.org/people/HashOil/sounds/534968/) by **HashOil** on [Freesound](https://freesound.org/) (retrieved 2026-08-20).
- **License:** [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) — public domain dedication, no attribution required. **Satisfies Rafiq's verified CC0/public-domain policy** (see `conductor/product.md`).
- **SHA-256:** `A6E7371DCE7E1E05F68349225C9AF47078A39EA79D27DD06D28B8457B08BAA1A`
- **File:** `src/assets/audio/adhan.mp3` (1,406,530 bytes / 1.34 MiB, MP3 VBR ~44 kbps, 44.1 kHz mono, 254.1 s, ID3v2.3 tags with source attribution).
- **Derivation:** Re-encoded from the Freesound HQ preview (153 kbps MP3 of the original recording) with `libmp3lame -q:a 8` mono; no content trimmed.
- **Size note:** A full 4:14 adhan at good quality exceeds the earlier soft "<500 KiB" placeholder target; ~1.3 MiB is immaterial for the desktop bundle, so the target was dropped.

> CC0 requires no attribution — provided here anyway per project practice.

## Changelog
- **2026-08-20** — Replaced the CC0 "Minaret" (Alanya, balcony recording) with the CC0 Amman adhan above: professional shotgun-mic field recording, full 4:14 adhan.
- **2026-08-20** — (superseded) Replaced the unlicensed "Athan Makkah" recording (no license granted by its source repo) with the CC0 "Minaret" adhan.
- **2026-08-20** — (superseded) Swapped the synthetic 4 s sine-wave placeholder for an "Athan Makkah" recording from [abodehq/Athan-MP3](https://github.com/abodehq/Athan-MP3). That source repo grants **no license** (all rights reserved by default), so it was not retained.
