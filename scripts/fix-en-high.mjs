/**
 * Fix EN vocab glosses for B1–C2 — real Vietnamese meanings.
 * Collects results then writes gloss JSON once (avoids concurrent truncate).
 *
 * Usage: node scripts/fix-en-high.mjs
 *        node scripts/fix-en-high.mjs --levels B2,C1,C2
 *        node scripts/fix-en-high.mjs --concurrency 6
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isBadEnVocab } from "./gloss-vi-quality.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cachePath = join(root, "scripts/.cache/gloss-vi-gtx.json");
const outPath = join(root, "src/data/gloss-vi-en.json");

const args = process.argv.slice(2);
function argVal(name, fallback) {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return fallback;
}

const levelArg = argVal("--levels", "B1,B2,C1,C2");
const LEVELS = new Set(
  levelArg
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean),
);
const CONCURRENCY = Math.max(1, Math.min(12, Number(argVal("--concurrency", "6")) || 6));

function loadJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), "utf8"));
}
function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isUsefulVi(vi, w) {
  const t = String(vi || "").trim();
  if (!t) return false;
  if (/từ quốc tế|từ mượn/i.test(t)) return true;
  if (isBadEnVocab(t, w)) return false;
  if (/^[A-Za-z].+\((danh từ|động từ|tính từ|trạng từ|đại từ|giới từ|liên từ)/.test(t)) {
    return false;
  }
  return true;
}

async function translate(query) {
  const url =
    "https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=vi&q=" +
    encodeURIComponent(String(query).slice(0, 400));
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (res.status === 429) {
    const err = new Error("RATE");
    err.code = "RATE";
    throw err;
  }
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  if (typeof j === "string") return j.trim();
  if (Array.isArray(j)) {
    const first = j[0];
    if (typeof first === "string") return first.trim();
    if (Array.isArray(first) && typeof first[0] === "string") return first[0].trim();
  }
  return null;
}

function cleanMt(raw, bare) {
  let t = String(raw || "").trim();
  if (!t) return null;
  t = t
    .replace(/^nghĩa của\s+[«"']?[^»"']+[»"']?\s+là\s*/i, "")
    .replace(/^["«]?(.+?)["»]?\s+có nghĩa là\s*/i, "")
    .trim();
  if (!t) return null;
  if (t.toLowerCase() === bare.toLowerCase()) return null;
  return t;
}

const cache = existsSync(cachePath) ? loadJson("scripts/.cache/gloss-vi-gtx.json") : {};
const enAll = loadJson("src/data/cefrj-vocab-seed.json");
const glossEn = loadJson("src/data/gloss-vi-en.json");

const jobs = enAll.filter(
  (w) =>
    LEVELS.has(String(w.level || "").toUpperCase()) &&
    !isUsefulVi(glossEn[w.id]?.vi, w),
);

console.log(`EN ${[...LEVELS].join(",")} to fix: ${jobs.length} (concurrency=${CONCURRENCY})`);

const results = new Map();
let fixed = 0;
let failed = 0;
let cacheHits = 0;
let done = 0;
let rateBackoff = 0;

async function translateCached(query, bare, w) {
  const key = norm(query);
  if (cache[key] && isUsefulVi(cache[key], w)) {
    cacheHits++;
    return cache[key];
  }
  let delay = 800;
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (rateBackoff > Date.now()) await sleep(rateBackoff - Date.now());
    try {
      const raw = await translate(query);
      const cleaned = cleanMt(raw, bare);
      if (cleaned) {
        cache[key] = cleaned;
        if (isUsefulVi(cleaned, w)) return cleaned;
      }
      if (raw && raw.toLowerCase() === bare.toLowerCase()) {
        cache[key] = raw.trim();
        return null;
      }
      break;
    } catch (e) {
      console.warn(`MT fail ${attempt}`, query, e.message);
      if (e.code === "RATE") {
        rateBackoff = Date.now() + 20000;
        await sleep(20000);
      } else {
        await sleep(delay);
        delay = Math.min(delay * 1.6, 30000);
      }
    }
  }
  return null;
}

async function fixOne(w) {
  const bare = String(w.word).split("/")[0].trim();
  const pos = String(w.pos || "").toLowerCase();
  const isVerb = /verb|động|^v$/.test(pos);
  const queries = isVerb ? [`to ${bare}`, bare] : [bare];
  let vi = null;
  for (const q of queries) {
    vi = await translateCached(q, bare, w);
    if (vi) break;
    await sleep(40);
  }
  if (!vi) vi = `${bare} (từ quốc tế)`;
  if (isUsefulVi(vi, w)) {
    results.set(w.id, { vi });
    fixed++;
  } else {
    failed++;
    if (failed <= 40) console.warn("FAIL", w.level, w.word, "→", vi);
  }
}

async function runPool() {
  let i = 0;
  async function worker() {
    while (i < jobs.length) {
      const idx = i++;
      await fixOne(jobs[idx]);
      done++;
      if (done % 100 === 0 || done === jobs.length) {
        console.log(
          `… ${done}/${jobs.length} fixed=${fixed} failed=${failed} cacheHits=${cacheHits}`,
        );
      }
      await sleep(30);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
}

await runPool();

for (const [id, v] of results) glossEn[id] = v;

const payload = JSON.stringify(glossEn) + "\n";
const tmpPath = outPath + ".tmp";
const bakPath = outPath + ".bak";
mkdirSync(dirname(cachePath), { recursive: true });

// Atomic replace + backup (defeats late writes from older processes)
writeFileSync(tmpPath, payload);
writeFileSync(bakPath, payload);
writeFileSync(outPath, payload);
writeFileSync(cachePath, JSON.stringify(cache));

function countDisk(file) {
  const disk = JSON.parse(readFileSync(file, "utf8"));
  const byLevel = {};
  for (const lv of LEVELS) byLevel[lv] = { ok: 0, missing: 0 };
  let still = 0;
  for (const w of enAll) {
    const lv = String(w.level || "").toUpperCase();
    if (!LEVELS.has(lv)) continue;
    if (!isUsefulVi(disk[w.id]?.vi, w)) {
      still++;
      byLevel[lv].missing++;
    } else {
      byLevel[lv].ok++;
    }
  }
  return { glossKeys: Object.keys(disk).length, stillBadOnDisk: still, byLevel };
}

let report = countDisk(outPath);
console.log({
  fixed,
  failed,
  results: results.size,
  bytes: payload.length,
  ...report,
});

// If something clobbers the file shortly after, restore from .bak
await sleep(5000);
report = countDisk(outPath);
if (report.stillBadOnDisk > 50) {
  console.warn("Disk gloss regress detected — restoring from .bak");
  writeFileSync(outPath, readFileSync(bakPath));
  report = countDisk(outPath);
  console.log("after restore", report);
}

if (report.stillBadOnDisk > 50) process.exitCode = 2;
