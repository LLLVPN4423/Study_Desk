/**
 * Smoke coverage + quality for Vietnamese gloss overlays.
 *
 * Usage:
 *   node scripts/smoke-gloss-vi.mjs --all
 *   node scripts/smoke-gloss-vi.mjs --jp N3 --en B1 --quality
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isBadEnVocab,
  isBadGrammar,
  isBadJpVocab,
  isBadKanji,
} from "./gloss-vi-quality.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const JP_LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const EN_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const JP_SEED = {
  N5: "src/data/openjlpt-n5-seed.json",
  N4: "src/data/openjlpt-n4-seed.json",
  N3: "src/data/openjlpt-n3-seed.json",
  N2: "src/data/openjlpt-n2-seed.json",
  N1: "src/data/openjlpt-n1-seed.json",
};
const KANJI_SEED = {
  N5: "src/data/openjlpt-kanji-n5.json",
  N4: "src/data/openjlpt-kanji-n4.json",
  N3: "src/data/openjlpt-kanji-n3.json",
  N2: "src/data/openjlpt-kanji-n2.json",
  N1: "src/data/openjlpt-kanji-n1.json",
};

function load(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) return Array.isArray(arguments[0]) ? [] : {};
  return JSON.parse(readFileSync(p, "utf8"));
}

function parseArgs(argv) {
  let jp = [];
  let en = [];
  let all = false;
  let quality = true;
  let kanji = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--jp" && argv[i + 1]) {
      jp = argv[++i].split(",").map((s) => s.trim().toUpperCase());
    } else if (argv[i] === "--en" && argv[i + 1]) {
      en = argv[++i].split(",").map((s) => s.trim().toUpperCase());
    } else if (argv[i] === "--all") {
      all = true;
    } else if (argv[i] === "--no-quality") {
      quality = false;
    } else if (argv[i] === "--kanji") {
      kanji = true;
    }
  }
  if (all) {
    jp = [...JP_LEVELS];
    en = [...EN_LEVELS];
    kanji = true;
  }
  return { jp, en, quality, kanji };
}

const { jp, en, quality, kanji } = parseArgs(process.argv.slice(2));
if (!jp.length && !en.length && !kanji) {
  console.error("Usage: --jp N4 --en A2 | --all [--kanji] [--no-quality]");
  process.exit(1);
}

const glossJp = load("src/data/gloss-vi-jp.json");
const glossEn = load("src/data/gloss-vi-en.json");
const glossGJp = load("src/data/gloss-vi-grammar-jp.json");
const glossGEn = load("src/data/gloss-vi-grammar-en.json");
const glossK = load("src/data/gloss-vi-kanji.json");
const enAll = load("src/data/cefrj-vocab-seed.json");
const gJpAll = load("src/data/grammar-jp.json");
const gEnAll = load("src/data/grammar-en.json");

let failed = 0;
const rows = [];

for (const lv of jp) {
  if (!JP_LEVELS.includes(lv)) continue;
  const words = load(JP_SEED[lv]);
  const g = gJpAll.filter((x) => String(x.level).toUpperCase() === lv);
  let missV = 0;
  let badV = 0;
  for (const w of words) {
    const vi = glossJp[w.id]?.vi;
    if (!vi?.trim()) missV++;
    else if (quality && isBadJpVocab(vi, w)) badV++;
  }
  let missG = 0;
  let badG = 0;
  for (const x of g) {
    const vi = glossGJp[x.id]?.vi;
    if (!vi?.trim()) missG++;
    else if (quality && isBadGrammar(vi, x)) badG++;
  }
  const miss = missV + badV + missG + badG;
  rows.push({
    band: `JP ${lv}`,
    vocabOk: `${words.length - missV - badV}/${words.length}`,
    badVocab: badV,
    grammarOk: `${g.length - missG - badG}/${g.length}`,
    badGram: badG,
  });
  failed += miss;
}

for (const lv of en) {
  if (!EN_LEVELS.includes(lv)) continue;
  const words = enAll.filter((w) => String(w.level).toUpperCase() === lv);
  const g = gEnAll.filter((x) => String(x.level).toUpperCase() === lv);
  let missV = 0;
  let badV = 0;
  for (const w of words) {
    const vi = glossEn[w.id]?.vi;
    if (!vi?.trim()) missV++;
    else if (quality && isBadEnVocab(vi, w)) badV++;
  }
  let missG = 0;
  let badG = 0;
  for (const x of g) {
    const vi = glossGEn[x.id]?.vi;
    if (!vi?.trim()) missG++;
    else if (quality && isBadGrammar(vi, x)) badG++;
  }
  rows.push({
    band: `EN ${lv}`,
    vocabOk: `${words.length - missV - badV}/${words.length}`,
    badVocab: badV,
    grammarOk: `${g.length - missG - badG}/${g.length}`,
    badGram: badG,
  });
  failed += missV + badV + missG + badG;
}

if (kanji) {
  for (const lv of JP_LEVELS) {
    const list = load(KANJI_SEED[lv]);
    let miss = 0;
    let bad = 0;
    for (const k of list) {
      const id = `kanji-${lv}-${k.character}`;
      const vi = glossK[id]?.vi;
      if (!vi?.trim()) miss++;
      else if (quality && isBadKanji(vi, k)) bad++;
    }
    rows.push({
      band: `Kanji ${lv}`,
      vocabOk: `${list.length - miss - bad}/${list.length}`,
      badVocab: bad,
      grammarOk: "—",
      badGram: 0,
    });
    failed += miss + bad;
  }
}

console.table(rows);
if (failed) {
  console.error(`FAIL: ${failed} missing/bad gloss entries`);
  process.exit(1);
}
console.log("OK: coverage + quality for selected bands");
