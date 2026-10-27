/** Dynamic loaders for grammar / kanji banks (by track or JLPT level). */

export type GrammarItem = {
  id: string;
  level: string;
  pattern: string;
  prompt: string;
  meaning: string;
  choices: string[];
  answer: number;
  note: string;
  tags?: string[];
};

export type KanjiItem = {
  character: string;
  level: string;
  meanings: string[];
  onyomi: string[];
  kunyomi: string[];
  strokes?: number;
  words?: string[];
};

export type KanjiLevel = "N5" | "N4" | "N3" | "N2" | "N1";

const grammarCache = new Map<"jp" | "en", GrammarItem[]>();
const grammarPending = new Map<"jp" | "en", Promise<GrammarItem[]>>();

const kanjiCache = new Map<KanjiLevel, KanjiItem[]>();
const kanjiPending = new Map<KanjiLevel, Promise<KanjiItem[]>>();

const kanjiLoaders: Record<KanjiLevel, () => Promise<{ default: KanjiItem[] }>> = {
  N5: () => import("@/data/openjlpt-kanji-n5.json"),
  N4: () => import("@/data/openjlpt-kanji-n4.json"),
  N3: () => import("@/data/openjlpt-kanji-n3.json"),
  N2: () => import("@/data/openjlpt-kanji-n2.json"),
  N1: () => import("@/data/openjlpt-kanji-n1.json"),
};

export async function ensureGrammarTrack(track: "jp" | "en"): Promise<GrammarItem[]> {
  const hit = grammarCache.get(track);
  if (hit) return hit;
  let p = grammarPending.get(track);
  if (!p) {
    p = (async () => {
      const mod =
        track === "jp"
          ? await import("@/data/grammar-jp.json")
          : await import("@/data/grammar-en.json");
      const rows = mod.default as GrammarItem[];
      grammarCache.set(track, rows);
      grammarPending.delete(track);
      return rows;
    })();
    grammarPending.set(track, p);
  }
  return p;
}

export function getGrammarTrack(track: "jp" | "en"): GrammarItem[] {
  return grammarCache.get(track) || [];
}

export async function ensureKanjiLevel(level: KanjiLevel): Promise<KanjiItem[]> {
  const hit = kanjiCache.get(level);
  if (hit) return hit;
  let p = kanjiPending.get(level);
  if (!p) {
    p = (async () => {
      const mod = await kanjiLoaders[level]();
      const rows = mod.default as KanjiItem[];
      kanjiCache.set(level, rows);
      kanjiPending.delete(level);
      return rows;
    })();
    kanjiPending.set(level, p);
  }
  return p;
}

export function getKanjiLevel(level: KanjiLevel): KanjiItem[] {
  return kanjiCache.get(level) || [];
}

export async function ensureKanjiCounts(): Promise<Record<KanjiLevel, number>> {
  const levels: KanjiLevel[] = ["N5", "N4", "N3", "N2", "N1"];
  await Promise.all(levels.map((lv) => ensureKanjiLevel(lv)));
  return Object.fromEntries(
    levels.map((lv) => [lv, getKanjiLevel(lv).length]),
  ) as Record<KanjiLevel, number>;
}
