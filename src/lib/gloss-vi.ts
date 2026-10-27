/**
 * Vietnamese gloss overlay for JP/EN learning content.
 * Maps load on demand per track (Desk / unused track stay out of the chunk).
 */
export type VocabGlossVi = { vi: string; exampleVi?: string };
export type GrammarGlossVi = { vi: string; noteVi?: string };

type GlossMap = Record<string, VocabGlossVi>;
type GrammarMap = Record<string, GrammarGlossVi>;

let JP: GlossMap = {};
let EN: GlossMap = {};
let G_JP: GrammarMap = {};
let G_EN: GrammarMap = {};
let KANJI: GlossMap = {};

let jpReady = false;
let enReady = false;
let kanjiReady = false;
let jpPending: Promise<void> | null = null;
let enPending: Promise<void> | null = null;
let kanjiPending: Promise<void> | null = null;

const VI_DIACRITIC =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/;

/** POS labels mistaken for definitions (bad seed / MT leftovers). */
const POS_LABEL_ONLY =
  /^(danh từ|động từ|tính từ|trạng từ|đại từ|giới từ|liên từ|thán từ|mạo từ|hạn định từ|trợ động từ|động từ khuyết thiếu|số từ|trợ từ|động từ to be|be-verb|noun|verb|adjective|adverb|pronoun|preposition|conjunction)$/i;

export function isPosLabelOnly(text: string | undefined | null): boolean {
  return POS_LABEL_ONLY.test(String(text || "").trim());
}

/** Reject MT fallback leftovers so UI does not show English-in-parens as "VI". */
function isUsableViGloss(vi: string, opts?: { word?: string }): boolean {
  const t = vi.trim();
  if (!t) return false;
  if (/MYMEMORY WARNING|&#x|&#\d/i.test(t)) return false;
  if (isPosLabelOnly(t)) return false;
  const w = (opts?.word || "").trim().toLowerCase();
  if (w && t.toLowerCase() === w) return false;
  // "abandon (động từ)" is NOT a real gloss — only allow loanword tags
  const m = t.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (w && m && m[1].trim().toLowerCase() === w) {
    const note = (m[2] || "").trim();
    if (/^(từ quốc tế|từ mượn)$/i.test(note)) {
      /* keep */
    } else {
      return false;
    }
  }
  if (/^[(（][^)）]+[)）]$/.test(t) && !VI_DIACRITIC.test(t) && /[A-Za-z]{3}/.test(t)) {
    return false;
  }
  return true;
}

const POS_VI: Record<string, string> = {
  "be-verb": "động từ to be",
  noun: "danh từ",
  n: "danh từ",
  verb: "động từ",
  v: "động từ",
  adjective: "tính từ",
  adj: "tính từ",
  adverb: "trạng từ",
  adv: "trạng từ",
  pronoun: "đại từ",
  preposition: "giới từ",
  conjunction: "liên từ",
  interjection: "thán từ",
  article: "mạo từ",
  determiner: "hạn định từ",
  auxiliary: "trợ động từ",
  modal: "động từ khuyết thiếu",
  numeral: "số từ",
  particle: "trợ từ",
};

const EN_WORD_VI: Record<string, string> = {
  "'m": "dạng rút của am (I am) — thì / là",
  "'re": "dạng rút của are (we/you/they are) — thì / là",
  "'s": "dạng rút của is/has — thì / là / có",
  "'ll": "dạng rút của will — sẽ",
  "'ve": "dạng rút của have — đã / có",
  "'d": "dạng rút của had/would — đã / sẽ (giả định)",
  "n't": "dạng rút của not — không",
  a: "một (mạo từ không xác định)",
  an: "một (trước nguyên âm)",
  the: "mạo từ xác định — cái / người đó",
  i: "tôi",
  you: "bạn / anh / chị",
  he: "anh ấy",
  she: "cô ấy",
  it: "nó",
  we: "chúng tôi / chúng ta",
  they: "họ",
  is: "thì / là (ngôi 3 số ít)",
  am: "thì / là (I)",
  are: "thì / là (you/we/they)",
  be: "thì / là / ở",
  yes: "có / vâng",
  no: "không",
  not: "không",
  and: "và",
  or: "hoặc",
  but: "nhưng",
  in: "trong / ở trong",
  on: "trên / vào",
  at: "ở / lúc",
  to: "đến / để",
  of: "của",
  for: "cho / vì",
  with: "với",
  from: "từ",
  this: "này",
  that: "đó / kia",
  these: "những cái này",
  those: "những cái đó",
  my: "của tôi",
  your: "của bạn",
  his: "của anh ấy",
  her: "của cô ấy / cô ấy (tân ngữ)",
  its: "của nó",
  our: "của chúng tôi",
  their: "của họ",
};

export function isGlossTrackReady(track: "jp" | "en"): boolean {
  return track === "jp" ? jpReady : enReady;
}

export function isKanjiGlossReady(): boolean {
  return kanjiReady;
}

export async function ensureGlossTrack(track: "jp" | "en"): Promise<void> {
  if (track === "jp") {
    if (jpReady) return;
    if (!jpPending) {
      jpPending = (async () => {
        const [vocab, grammar] = await Promise.all([
          import("@/data/gloss-vi-jp.json"),
          import("@/data/gloss-vi-grammar-jp.json"),
        ]);
        JP = vocab.default as GlossMap;
        G_JP = grammar.default as GrammarMap;
        jpReady = true;
        jpPending = null;
      })();
    }
    await jpPending;
    return;
  }
  if (enReady) return;
  if (!enPending) {
    enPending = (async () => {
      const [vocab, grammar] = await Promise.all([
        import("@/data/gloss-vi-en.json"),
        import("@/data/gloss-vi-grammar-en.json"),
      ]);
      EN = vocab.default as GlossMap;
      G_EN = grammar.default as GrammarMap;
      enReady = true;
      enPending = null;
    })();
  }
  await enPending;
}

export async function ensureKanjiGloss(): Promise<void> {
  if (kanjiReady) return;
  if (!kanjiPending) {
    kanjiPending = (async () => {
      const mod = await import("@/data/gloss-vi-kanji.json");
      KANJI = mod.default as GlossMap;
      kanjiReady = true;
      kanjiPending = null;
    })();
  }
  await kanjiPending;
}

export function posToVi(pos: string | undefined | null): string | null {
  if (!pos) return null;
  const key = pos.trim().toLowerCase();
  if (POS_VI[key]) return POS_VI[key];
  const first = key.split(/[,/]/)[0]?.trim();
  if (first && POS_VI[first]) return POS_VI[first];
  if (/^v\d/.test(first || "") || first?.startsWith("vs")) return "động từ";
  if (first?.startsWith("adj")) return "tính từ";
  if (first === "n" || first?.startsWith("n-")) return "danh từ";
  return null;
}

export function getVocabGlossVi(
  track: "jp" | "en",
  sourceId: string,
  opts?: { word?: string },
): VocabGlossVi | null {
  const hit = (track === "jp" ? JP : EN)[sourceId];
  if (!hit?.vi?.trim()) return null;
  if (!isUsableViGloss(hit.vi, opts)) return null;
  return hit;
}

export function getGrammarGlossVi(
  track: "jp" | "en",
  id: string,
): GrammarGlossVi | null {
  const hit = (track === "jp" ? G_JP : G_EN)[id];
  if (!hit?.vi?.trim()) return null;
  if (!VI_DIACRITIC.test(hit.vi) && /[A-Za-z]{4}/.test(hit.vi)) return null;
  return hit;
}

export function kanjiGlossId(level: string, character: string): string {
  return `kanji-${level}-${character}`;
}

export function getKanjiGlossVi(
  level: string,
  character: string,
): VocabGlossVi | null {
  const hit = KANJI[kanjiGlossId(level, character)];
  if (!hit?.vi?.trim()) return null;
  if (!isUsableViGloss(hit.vi)) return null;
  return hit;
}

export function displayKanjiMeanings(
  level: string,
  character: string,
  fallbackEn: string[],
): string[] {
  const gloss = getKanjiGlossVi(level, character);
  if (gloss?.vi) return [gloss.vi];
  return fallbackEn?.length ? fallbackEn : ["(chưa có nghĩa tiếng Việt)"];
}

/**
 * Meanings shown on SRS / dictionary — Vietnamese first.
 */
export function displayMeanings(
  track: "jp" | "en",
  sourceId: string,
  fallbackEn: string[],
  opts?: { word?: string; pos?: string },
): string[] {
  const gloss = getVocabGlossVi(track, sourceId, { word: opts?.word });
  if (gloss?.vi) {
    const out = [gloss.vi];
    const posVi = posToVi(opts?.pos);
    if (posVi) out.push(posVi);
    return out;
  }

  if (track === "en" && opts?.word) {
    const w = opts.word.trim().toLowerCase();
    if (EN_WORD_VI[w]) {
      const out = [EN_WORD_VI[w]];
      const posVi = posToVi(opts.pos);
      if (posVi) out.push(posVi);
      return out;
    }
  }

  const word = (opts?.word || "").trim().toLowerCase();
  const cleaned = (fallbackEn || []).filter(
    (m) =>
      m &&
      m.trim() &&
      m.trim().toLowerCase() !== word &&
      !/^EN ·/i.test(m) &&
      !/^CEFR /i.test(m) &&
      !isPosLabelOnly(m),
  );
  const posVi = posToVi(opts?.pos);
  if (cleaned.length) {
    if (posVi && cleaned[0] !== posVi) return [cleaned[0], posVi];
    return [cleaned[0]];
  }

  if (track === "en") {
    return posVi
      ? ["(chưa có nghĩa tiếng Việt)", posVi]
      : ["(chưa có nghĩa tiếng Việt)"];
  }
  if (posVi) return [posVi];
  return fallbackEn?.length ? fallbackEn : ["(chưa có nghĩa)"];
}

export function displayExampleVi(
  track: "jp" | "en",
  sourceId: string,
): string | undefined {
  return getVocabGlossVi(track, sourceId)?.exampleVi;
}

export function displayGrammarMeaning(
  track: "jp" | "en",
  id: string,
  fallbackEn: string,
): string {
  return getGrammarGlossVi(track, id)?.vi || fallbackEn;
}

export function displayGrammarNote(
  track: "jp" | "en",
  id: string,
  fallbackEn?: string,
): string | undefined {
  return getGrammarGlossVi(track, id)?.noteVi || fallbackEn;
}
