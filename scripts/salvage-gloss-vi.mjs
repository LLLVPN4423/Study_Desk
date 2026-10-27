import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isBadEnVocab,
  isBadJpVocab,
  isBadKanji,
} from "./gloss-vi-quality.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function load(rel) {
  return JSON.parse(readFileSync(join(root, rel), "utf8"));
}
function save(rel, data) {
  writeFileSync(join(root, rel), JSON.stringify(data) + "\n");
}
function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
function prepare(text) {
  let query = String(text || "").trim();
  query = query.replace(
    /^\((?:humble|honorable|honourable|abbr\.?|abbreviation|colloquial|formal|polite|plain|archaic|obsolete|slang|gram|telephone|car|train|measuring|human|the|not so|member of)[^)]*\)\s*/i,
    "",
  );
  query = query.replace(/^to\s+/i, "").trim();
  query = query.replace(/^\((?:the|a|an)\)\s*/i, "").trim();
  return query;
}

const cache = load("scripts/.cache/gloss-vi-gtx.json");
const jpG = load("src/data/gloss-vi-jp.json");
let salvaged = 0;
let needMt = 0;
for (const lv of ["n5", "n4", "n3", "n2", "n1"]) {
  for (const w of load(`src/data/openjlpt-${lv}-seed.json`)) {
    if (!isBadJpVocab(jpG[w.id]?.vi, w)) continue;
    const src = (w.meanings && w.meanings[0]) || w.word;
    const q = prepare(src);
    const hit =
      cache[norm(q)] ||
      cache[norm(src)] ||
      cache[norm(String(src).replace(/^to\s+/i, ""))];
    if (hit && !isBadJpVocab(hit, w)) {
      jpG[w.id] = { vi: hit };
      salvaged++;
    } else {
      needMt++;
    }
  }
}
save("src/data/gloss-vi-jp.json", jpG);
console.log({ jpSalvaged: salvaged, jpNeedMt: needMt });

const enG = load("src/data/gloss-vi-en.json");
let enFix = 0;
for (const w of load("src/data/cefrj-vocab-seed.json")) {
  if (!isBadEnVocab(enG[w.id]?.vi, w)) continue;
  const word = String(w.word).split("/")[0].trim();
  enG[w.id] = { vi: `${word} (từ quốc tế)` };
  enFix++;
}
save("src/data/gloss-vi-en.json", enG);
console.log({ enLoanwordFix: enFix });

const kG = load("src/data/gloss-vi-kanji.json");
let kSal = 0;
let kNeed = 0;
for (const lv of ["N5", "N4", "N3", "N2", "N1"]) {
  for (const k of load(`src/data/openjlpt-kanji-${lv.toLowerCase()}.json`)) {
    const id = `kanji-${lv}-${k.character}`;
    const entry = { ...k, id, level: lv };
    if (!isBadKanji(kG[id]?.vi, entry)) continue;
    const src = (k.meanings || []).slice(0, 3).join("; ");
    const hit = cache[norm(src)] || cache[norm(k.meanings?.[0] || "")];
    if (hit && !isBadKanji(hit, entry)) {
      kG[id] = { vi: hit };
      kSal++;
    } else {
      kNeed++;
    }
  }
}
save("src/data/gloss-vi-kanji.json", kG);
console.log({ kSal, kNeed });
