/**
 * Vietnamese gloss overlay for JP/EN learning content.
 * Seed files stay EN; display prefers VI when present.
 */
import glossEn from "@/data/gloss-vi-en.json";
import glossJp from "@/data/gloss-vi-jp.json";
import glossGrammarEn from "@/data/gloss-vi-grammar-en.json";
import glossGrammarJp from "@/data/gloss-vi-grammar-jp.json";

export type VocabGlossVi = { vi: string; exampleVi?: string };
export type GrammarGlossVi = { vi: string; noteVi?: string };

type GlossMap = Record<string, VocabGlossVi>;
type GrammarMap = Record<string, GrammarGlossVi>;

const JP = glossJp as GlossMap;
const EN = glossEn as GlossMap;
const G_JP = glossGrammarJp as GrammarMap;
const G_EN = glossGrammarEn as GrammarMap;

/** POS / grammar labels EN → VI (short). */
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

/** High-frequency EN contractions / function forms for A1. */
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

export function posToVi(pos: string | undefined | null): string | null {
  if (!pos) return null;
  const key = pos.trim().toLowerCase();
  if (POS_VI[key]) return POS_VI[key];
  // OpenJLPT-style "v5u,vi"
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
): VocabGlossVi | null {
  const hit = (track === "jp" ? JP : EN)[sourceId];
  if (!hit?.vi?.trim()) return null;
  return hit;
}

export function getGrammarGlossVi(
  track: "jp" | "en",
  id: string,
): GrammarGlossVi | null {
  const hit = (track === "jp" ? G_JP : G_EN)[id];
  if (!hit?.vi?.trim()) return null;
  return hit;
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
  const gloss = getVocabGlossVi(track, sourceId);
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

  // Fallback: clean EN meanings; never show word repeated as sole "meaning"
  const word = (opts?.word || "").trim().toLowerCase();
  const cleaned = (fallbackEn || []).filter(
    (m) =>
      m &&
      m.trim() &&
      m.trim().toLowerCase() !== word &&
      !/^EN ·/i.test(m) &&
      !/^CEFR /i.test(m),
  );
  if (cleaned.length) {
    const posVi = posToVi(opts?.pos);
    return posVi ? [cleaned[0], posVi] : [cleaned[0]];
  }

  const posVi = posToVi(opts?.pos);
  if (posVi) return [posVi];
  if (track === "en") return ["(chưa có nghĩa tiếng Việt)"];
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
