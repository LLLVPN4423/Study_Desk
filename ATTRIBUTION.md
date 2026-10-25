# Attribution

## OpenJLPT

Japanese vocabulary, kanji, and grammar used in Study Desk lists, reviews, and drills.

- Project: [OpenJLPT](https://github.com/evanclan/OpenJLPT)
- License: **CC BY-SA 4.0**
- Vocab: full N5–N1 (`openjlpt-n5-seed.json` … `openjlpt-n1-seed.json`) — ~7,811 words
- Grammar: full N5–N1 (`grammar-jp.json`) — ~526 points, adapted into fill-in drills
- Kanji: N5–N2 (`openjlpt-kanji-n5` … `openjlpt-kanji-n2`)
- Upstream NOTICE / sources (JMdict, KANJIDIC2, Waller lists, Tatoeba) must be respected when redistributing or modifying (ShareAlike).

> Vocabulary, kanji and grammar data from OpenJLPT (CC BY-SA 4.0).

## CEFR-J

English vocabulary seed for the EN learning path.

- Dataset mirror: [olp-en-cefrj](https://github.com/openlanguageprofiles/olp-en-cefrj)
- Source: CEFR-J Wordlist Version 1.5, compiled by Yukio Tono, Tokyo University of Foreign Studies (TUFS)
- Seed file: `src/data/cefrj-a1a2-seed.json` — full A1 + A2 profile (~2,575 headword·POS entries)
- Official downloads / terms: [cefr-j.org](https://www.cefr-j.org/download.html) — research and commercial use with proper citation; copyright belongs to Tono Laboratory at TUFS

> English vocabulary levels from the CEFR-J Wordlist (TUFS / Open Language Profiles).

EN grammar drills in `grammar-en.json` are original CEFR-style practice items (not from CEFR-J).

## Japan Heritage

Culture explorer seed: [code4fukui/japan-heritage](https://github.com/code4fukui/japan-heritage) (MIT).  
Static subset in `src/data/japan-heritage-seed.json`. Official story links go to Agency for Cultural Affairs pages.

Japan region map outlines: simplified GeoJSON adapted from [aoheart/Japan-regions](https://github.com/aoheart/Japan-regions) (OSM / name-suggestion-index). Paths baked into `src/data/japan-region-paths.json`.

## Photography

Landing hero references Unsplash photo credit as shown in the Figma Make export (Chris Vasquez).

## Libraries

- Next.js, React — respective open licenses
- `ts-fsrs` — MIT
