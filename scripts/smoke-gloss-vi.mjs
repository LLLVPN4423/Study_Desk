/**
 * Smoke coverage for Vietnamese gloss overlays by level.
 *
 * Usage:
 *   node scripts/smoke-gloss-vi.mjs --jp N4 --en A2
 *   node scripts/smoke-gloss-vi.mjs --all
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

function load(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, "utf8"));
}

function parseArgs(argv) {
  let jp = [];
  let en = [];
  let all = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--jp" && argv[i + 1]) {
      jp = argv[++i].split(",").map((s) => s.trim().toUpperCase());
    } else if (argv[i] === "--en" && argv[i + 1]) {
      en = argv[++i].split(",").map((s) => s.trim().toUpperCase());
    } else if (argv[i] === "--all") {
      all = true;
    }
  }
  if (all) {
    jp = [...JP_LEVELS];
    en = [...EN_LEVELS];
  }
  return { jp, en };
}

function missCount(ids, map) {
  return ids.filter((id) => !map[id]?.vi?.trim()).length;
}

const { jp, en } = parseArgs(process.argv.slice(2));
if (!jp.length && !en.length) {
  console.error("Usage: --jp N4,N5 --en A2 | --all");
  process.exit(1);
}

const glossJp = load("src/data/gloss-vi-jp.json");
const glossEn = load("src/data/gloss-vi-en.json");
const glossGJp = load("src/data/gloss-vi-grammar-jp.json");
const glossGEn = load("src/data/gloss-vi-grammar-en.json");
const enAll = load("src/data/cefrj-vocab-seed.json");
const gJpAll = load("src/data/grammar-jp.json");
const gEnAll = load("src/data/grammar-en.json");

let failed = 0;
const rows = [];

for (const lv of jp) {
  if (!JP_LEVELS.includes(lv)) continue;
  const words = load(JP_SEED[lv]);
  const g = gJpAll.filter((x) => String(x.level).toUpperCase() === lv);
  const mv = missCount(
    words.map((w) => w.id),
    glossJp,
  );
  const mg = missCount(
    g.map((x) => x.id),
    glossGJp,
  );
  rows.push({ band: `JP ${lv}`, vocab: `${words.length - mv}/${words.length}`, grammar: `${g.length - mg}/${g.length}`, miss: mv + mg });
  failed += mv + mg;
}

for (const lv of en) {
  if (!EN_LEVELS.includes(lv)) continue;
  const words = enAll.filter((w) => String(w.level).toUpperCase() === lv);
  const g = gEnAll.filter((x) => String(x.level).toUpperCase() === lv);
  const mv = missCount(
    words.map((w) => w.id),
    glossEn,
  );
  const mg = missCount(
    g.map((x) => x.id),
    glossGEn,
  );
  rows.push({ band: `EN ${lv}`, vocab: `${words.length - mv}/${words.length}`, grammar: `${g.length - mg}/${g.length}`, miss: mv + mg });
  failed += mv + mg;
}

console.table(rows);
if (failed) {
  console.error(`FAIL: ${failed} missing gloss entries`);
  process.exit(1);
}
console.log("OK: full coverage for selected bands");
