/**
 * Re-translate bad Vietnamese glosses (vocab / grammar / kanji).
 * Uses google-translate-api-x (MyMemory often quota-exhausted).
 *
 * Usage:
 *   node scripts/fix-gloss-vi.mjs --vocab --grammar
 *   node scripts/fix-gloss-vi.mjs --kanji
 *   node scripts/fix-gloss-vi.mjs --all
 *   node scripts/fix-gloss-vi.mjs --dry-run
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  isBadEnVocab,
  isBadGrammar,
  isBadJpVocab,
  isBadKanji,
} from "./gloss-vi-quality.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cachePath = join(root, "scripts", ".cache", "gloss-vi-gtx.json");

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
  return JSON.parse(readFileSync(join(root, rel), "utf8"));
}

function loadMap(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function saveMap(rel, data) {
  writeFileSync(join(root, rel), JSON.stringify(data) + "\n");
}

function loadCache() {
  if (!existsSync(cachePath)) return {};
  try {
    return JSON.parse(readFileSync(cachePath, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cache));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cleanMt(text, source) {
  let t = String(text || "").trim();
  if (!t) return null;
  if (/MYMEMORY WARNING|QUERY LENGTH|INVALID LANGUAGE/i.test(t)) return null;
  if (/\[object |HTMLTextArea|&#x/i.test(t)) return null;
  if (/^to\s+/i.test(source) && /^để\s+/i.test(t)) {
    t = t.replace(/^để\s+/i, "").trim();
  }
  // Decode accidental HTML entities
  t = t.replace(/&#x([0-9a-f]+);/gi, (_, h) => {
    try {
      return String.fromCharCode(parseInt(h, 16));
    } catch {
      return "";
    }
  });
  return t.trim() || null;
}

/** Strip JLPT meta tags so MT gets the real gloss. */
function prepareEnGlossQuery(text) {
  let query = String(text || "").trim();
  if (!query) return "";
  query = query.replace(
    /^\((?:humble|honorable|honourable|abbr\.?|abbreviation|colloquial|formal|polite|plain|archaic|obsolete|slang|gram|telephone|car|train|measuring|human|the|not so|member of)[^)]*\)\s*/i,
    "",
  );
  query = query.replace(/^to\s+/i, "").trim();
  query = query.replace(/^\((?:the|a|an)\)\s*/i, "").trim();
  return query;
}

/** Chrome dict endpoint — steadier under load than google-translate-api-x. */
async function translateViaChromeDict(query) {
  const url =
    "https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=vi&q=" +
    encodeURIComponent(query.slice(0, 450));
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json,*/*",
    },
  });
  if (res.status === 429) {
    const err = new Error("Too Many Requests");
    err.code = "RATE";
    throw err;
  }
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  if (typeof j === "string") return j;
  if (Array.isArray(j)) {
    const first = j[0];
    if (typeof first === "string") return first;
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  }
  if (j?.sentences?.[0]?.trans) return j.sentences[0].trans;
  return null;
}

async function translateEnVi(text, cache) {
  const src = String(text || "").trim();
  if (!src) return null;
  let query = prepareEnGlossQuery(src);
  if (!query) query = src;
  const key = normalizeKey(query);
  if (cache[key]) return cache[key];

  let delay = 2500;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const raw = await translateViaChromeDict(query);
      const cleaned = cleanMt(raw, src);
      if (cleaned) {
        cache[key] = cleaned;
        return cleaned;
      }
    } catch (e) {
      console.warn("MT fail " + attempt + ":", e.message || e);
      await sleep(e.code === "RATE" ? Math.max(delay, 20000) : delay);
      delay = Math.min(delay * 1.5, 90000);
    }
  }
  return null;
}

function parseArgs(argv) {
  const out = {
    vocab: false,
    grammar: false,
    kanji: false,
    dryRun: false,
    jp: null,
    en: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") {
      out.vocab = out.grammar = out.kanji = true;
    } else if (a === "--vocab") out.vocab = true;
    else if (a === "--grammar") out.grammar = true;
    else if (a === "--kanji") out.kanji = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--jp" && argv[i + 1])
      out.jp = argv[++i].split(",").map((s) => s.trim().toUpperCase());
    else if (a === "--en" && argv[i + 1])
      out.en = argv[++i].split(",").map((s) => s.trim().toUpperCase());
  }
  if (!out.vocab && !out.grammar && !out.kanji) {
    out.vocab = out.grammar = out.kanji = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cache = loadCache();
  let fixed = 0;
  let failed = 0;

  if (args.vocab) {
    const glossJp = loadMap("src/data/gloss-vi-jp.json");
    const glossEn = loadMap("src/data/gloss-vi-en.json");
    // If --en or --jp given, only those tracks; else all.
    const jpLevels = args.jp
      ? args.jp
      : args.en
        ? []
        : ["N5", "N4", "N3", "N2", "N1"];
    const enLevels = args.en
      ? args.en
      : args.jp
        ? []
        : ["A1", "A2", "B1", "B2", "C1", "C2"];

    const jpJobs = [];
    for (const lv of jpLevels) {
      for (const w of load(JP_SEED[lv])) {
        if (isBadJpVocab(glossJp[w.id]?.vi, w)) jpJobs.push(w);
      }
    }
    const enAll = load("src/data/cefrj-vocab-seed.json");
    const enJobs = enAll.filter(
      (w) =>
        enLevels.includes(String(w.level || "").toUpperCase()) &&
        isBadEnVocab(glossEn[w.id]?.vi, w),
    );

    console.log(`Vocab bad: JP ${jpJobs.length}, EN ${enJobs.length}`);
    if (!args.dryRun) {
      let i = 0;
      const total = jpJobs.length + enJobs.length;
      for (const w of jpJobs) {
        const src = (w.meanings && w.meanings[0]) || w.romaji || w.word;
        let vi = (await translateEnVi(src, cache)) || null;
        // Loanword / proper noun: keep international form with VI tag
        if (vi && isBadJpVocab(vi, w)) {
          const bare = prepareEnGlossQuery(src) || src;
          if (
            /^[A-Za-z][A-Za-z0-9\-']{0,24}$/.test(bare) &&
            vi.toLowerCase() === bare.toLowerCase()
          ) {
            vi = `${bare} (từ mượn)`;
          }
        }
        if (vi && !isBadJpVocab(vi, w)) {
          glossJp[w.id] = { vi };
          fixed++;
        } else {
          failed++;
          console.warn("JP still bad", w.id, w.word, src, "→", vi);
        }
        i++;
        if (i % 40 === 0) {
          saveCache(cache);
          saveMap("src/data/gloss-vi-jp.json", glossJp);
          console.log(`… vocab ${i}/${total}`);
        }
        await sleep(180);
      }
      for (const w of enJobs) {
        const pos = String(w.pos || "").toLowerCase();
        const isVerb = /verb|động/.test(pos) || pos === "v";
        let vi = (await translateEnVi(w.word, cache)) || null;
        if (!vi || isBadEnVocab(vi, w)) {
          const alt = isVerb ? `to ${w.word.split("/")[0].trim()}` : w.word;
          vi = (await translateEnVi(alt, cache)) || vi;
        }
        if (!vi || isBadEnVocab(vi, w)) {
          const raw = (w.meanings || []).find(
            (m) =>
              m &&
              m !== w.word &&
              !/^EN ·/i.test(m) &&
              !/^(danh|động|tính|trạng|đại|giới|liên|thán|mạo|hạn|trợ|số|be-verb)/i.test(
                m,
              ),
          );
          if (raw) vi = (await translateEnVi(raw, cache)) || vi;
        }
        // True internationalisms that don't translate
        if (vi && isBadEnVocab(vi, w)) {
          const bare = w.word.split("/")[0].trim();
          if (vi.toLowerCase() === bare.toLowerCase() || vi.toLowerCase() === w.word.toLowerCase()) {
            vi = `${bare} (từ quốc tế)`;
          }
        }
        if (vi && !isBadEnVocab(vi, w)) {
          glossEn[w.id] = { vi };
          fixed++;
        } else {
          failed++;
          console.warn("EN still bad", w.id, w.word, "→", vi);
        }
        i++;
        if (i % 40 === 0) {
          saveCache(cache);
          saveMap("src/data/gloss-vi-en.json", glossEn);
          console.log(`… vocab ${i}/${total}`);
        }
        await sleep(200);
      }
      saveMap("src/data/gloss-vi-jp.json", glossJp);
      // Only rewrite EN file when this run touched EN jobs (avoid clobbering)
      if (enTodo.length) saveMap("src/data/gloss-vi-en.json", glossEn);
    }
  }

  if (args.grammar) {
    const glossGJp = loadMap("src/data/gloss-vi-grammar-jp.json");
    const glossGEn = loadMap("src/data/gloss-vi-grammar-en.json");
    const gJp = load("src/data/grammar-jp.json").filter((g) =>
      isBadGrammar(glossGJp[g.id]?.vi, g),
    );
    const gEn = load("src/data/grammar-en.json").filter((g) =>
      isBadGrammar(glossGEn[g.id]?.vi, g),
    );
    console.log(`Grammar bad: JP ${gJp.length}, EN ${gEn.length}`);
    if (!args.dryRun) {
      let i = 0;
      const total = gJp.length + gEn.length;
      for (const g of gJp) {
        const vi = (await translateEnVi(g.meaning, cache)) || g.meaning;
        const noteSrc = g.note ? String(g.note).split("·")[0].trim() : "";
        const noteVi = noteSrc
          ? (await translateEnVi(noteSrc.slice(0, 220), cache)) || undefined
          : undefined;
        if (!isBadGrammar(vi, g)) {
          glossGJp[g.id] = noteVi ? { vi, noteVi } : { vi };
          fixed++;
        } else {
          failed++;
          console.warn("G-JP still bad", g.id, vi);
        }
        i++;
        if (i % 20 === 0) {
          saveCache(cache);
          saveMap("src/data/gloss-vi-grammar-jp.json", glossGJp);
          console.log(`… grammar ${i}/${total}`);
        }
        await sleep(220);
      }
      for (const g of gEn) {
        // Prefer full meaning; if it's a terse EN label, expand for MT
        const src =
          g.meaning && g.meaning.length > 3
            ? g.meaning
            : `English grammar: ${g.pattern} — ${g.meaning || g.note || ""}`;
        let vi = (await translateEnVi(src, cache)) || null;
        if (!vi || isBadGrammar(vi, g)) {
          vi =
            (await translateEnVi(
              `Explain in Vietnamese: ${g.pattern}. ${g.meaning || ""}`,
              cache,
            )) || vi;
        }
        const noteVi = g.note
          ? (await translateEnVi(String(g.note).slice(0, 220), cache)) ||
            undefined
          : undefined;
        if (vi && !isBadGrammar(vi, g)) {
          glossGEn[g.id] = noteVi ? { vi, noteVi } : { vi };
          fixed++;
        } else {
          failed++;
          console.warn("G-EN still bad", g.id, vi);
        }
        i++;
        if (i % 20 === 0) {
          saveCache(cache);
          saveMap("src/data/gloss-vi-grammar-en.json", glossGEn);
          console.log(`… grammar ${i}/${total}`);
        }
        await sleep(220);
      }
      saveMap("src/data/gloss-vi-grammar-jp.json", glossGJp);
      saveMap("src/data/gloss-vi-grammar-en.json", glossGEn);
    }
  }

  if (args.kanji) {
    const glossK = loadMap("src/data/gloss-vi-kanji.json");
    const jobs = [];
    for (const lv of Object.keys(KANJI_SEED)) {
      for (const k of load(KANJI_SEED[lv])) {
        const id = `kanji-${lv}-${k.character}`;
        const entry = { ...k, id, level: lv };
        if (isBadKanji(glossK[id]?.vi, entry)) jobs.push(entry);
      }
    }
    console.log(`Kanji bad/missing: ${jobs.length}`);
    if (!args.dryRun) {
      let i = 0;
      for (const k of jobs) {
        const src = (k.meanings || []).slice(0, 3).join("; ") || k.character;
        const vi = await translateEnVi(src, cache);
        if (vi && !isBadKanji(vi, k)) {
          glossK[k.id] = { vi };
          fixed++;
        } else {
          failed++;
          console.warn("Kanji still bad", k.id, src, "→", vi);
        }
        i++;
        if (i % 40 === 0) {
          saveCache(cache);
          saveMap("src/data/gloss-vi-kanji.json", glossK);
          console.log(`… kanji ${i}/${jobs.length}`);
        }
        await sleep(200);
      }
      saveMap("src/data/gloss-vi-kanji.json", glossK);
    }
  }

  saveCache(cache);
  console.log(
    args.dryRun
      ? "Dry-run only (counts above)."
      : `Done. fixed=${fixed} failed=${failed}`,
  );
  if (!args.dryRun && failed > 0) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
