/**
 * Lesson registry — packages OpenJLPT / CEFR / grammar / kanji / mocks
 * into stable lesson units for browse + path (each PathTimeline day = 1 lesson).
 */
import grammarEn from "@/data/grammar-en.json";
import grammarJp from "@/data/grammar-jp.json";
import kanjiN1 from "@/data/openjlpt-kanji-n1.json";
import kanjiN2 from "@/data/openjlpt-kanji-n2.json";
import kanjiN3 from "@/data/openjlpt-kanji-n3.json";
import kanjiN4 from "@/data/openjlpt-kanji-n4.json";
import kanjiN5 from "@/data/openjlpt-kanji-n5.json";
import bandMocks from "@/data/mocks-by-band.json";
import {
  enPrimaryLevel,
  jpVocabLevels,
  primaryLevelPool,
  type TrackId,
  type VocabSeed,
} from "./roadmap";
import {
  normalizePathGoals,
  type PathGoals,
  type PathIntensity,
} from "./path-goals";

export type LessonKind = "vocab" | "grammar" | "kanji" | "listening" | "mock";

export type LessonItem =
  | { type: "vocab"; sourceId: string }
  | { type: "grammar"; sourceId: string }
  | { type: "kanji"; sourceId: string }
  | { type: "mockQ"; sourceId: string; packId: string };

export type Lesson = {
  id: string;
  track: TrackId;
  band: string;
  kind: LessonKind;
  index: number;
  title: string;
  estMinutes: number;
  items: LessonItem[];
};

type GrammarRow = { id: string; level: string; pattern: string };
type KanjiRow = { character: string; level: string };
type MockPackRow = {
  id: string;
  title: string;
  track: string;
  band?: string;
  mode?: string;
  minutes?: number;
  questions?: { id: string }[];
};

const VOCAB_PER = 20;
const GRAMMAR_PER = 6;
const KANJI_PER = 12;

const JP_BANDS = ["N5", "N4", "N3", "N2", "N1"] as const;
const EN_BANDS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const KANJI_BY_LEVEL: Record<string, KanjiRow[]> = {
  N5: kanjiN5 as KanjiRow[],
  N4: kanjiN4 as KanjiRow[],
  N3: kanjiN3 as KanjiRow[],
  N2: kanjiN2 as KanjiRow[],
  N1: kanjiN1 as KanjiRow[],
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function padIndex(n: number): string {
  return String(n).padStart(3, "0");
}

function kindLabel(kind: LessonKind, band: string, n: number): string {
  if (kind === "vocab") return `Từ vựng ${band} · nhóm ${n}`;
  if (kind === "grammar") return `Ngữ pháp ${band} · nhóm ${n}`;
  if (kind === "kanji") return `Kanji ${band} · nhóm ${n}`;
  if (kind === "listening") return `Nghe ${band}`;
  return `Mock ${band}`;
}

function estFor(kind: LessonKind, itemCount: number, packMinutes?: number): number {
  if (kind === "listening" || kind === "mock") return packMinutes || 10;
  if (kind === "grammar") return Math.max(8, itemCount * 2);
  if (kind === "kanji") return Math.max(8, Math.round(itemCount * 1.2));
  return Math.max(10, Math.round(itemCount * 0.8));
}

function vocabLessons(track: TrackId, band: string): Lesson[] {
  const pool = primaryLevelPool(track, band);
  return chunk(pool, VOCAB_PER).map((slice, i) => {
    const index = i + 1;
    return {
      id: `${track}-${band}-vocab-${padIndex(index)}`,
      track,
      band,
      kind: "vocab" as const,
      index,
      title: kindLabel("vocab", band, index),
      estMinutes: estFor("vocab", slice.length),
      items: slice.map((w: VocabSeed) => ({ type: "vocab" as const, sourceId: w.id })),
    };
  });
}

function grammarLessons(track: TrackId, band: string): Lesson[] {
  const primary = track === "jp" ? jpVocabLevels(band).primary : enPrimaryLevel(band);
  const bank = (track === "jp" ? grammarJp : grammarEn) as GrammarRow[];
  const rows = bank.filter((g) => g.level === primary);
  return chunk(rows, GRAMMAR_PER).map((slice, i) => {
    const index = i + 1;
    return {
      id: `${track}-${band}-grammar-${padIndex(index)}`,
      track,
      band,
      kind: "grammar" as const,
      index,
      title: kindLabel("grammar", band, index),
      estMinutes: estFor("grammar", slice.length),
      items: slice.map((g) => ({ type: "grammar" as const, sourceId: g.id })),
    };
  });
}

function kanjiLessons(band: string): Lesson[] {
  const primary = jpVocabLevels(band).primary;
  const rows = KANJI_BY_LEVEL[primary] || [];
  return chunk(rows, KANJI_PER).map((slice, i) => {
    const index = i + 1;
    return {
      id: `jp-${band}-kanji-${padIndex(index)}`,
      track: "jp" as const,
      band,
      kind: "kanji" as const,
      index,
      title: kindLabel("kanji", band, index),
      estMinutes: estFor("kanji", slice.length),
      items: slice.map((k) => ({
        type: "kanji" as const,
        sourceId: `kanji:${k.character}`,
      })),
    };
  });
}

function mockLessons(track: TrackId, band: string): Lesson[] {
  const packs = ((bandMocks as { packs?: MockPackRow[] }).packs || []).filter(
    (p) => p.track === track && p.band === band && (p.questions?.length || 0) > 0,
  );
  const out: Lesson[] = [];
  for (const p of packs) {
    const mode = p.mode === "listening" ? "listening" : "mock";
    const kind: LessonKind = mode;
    out.push({
      id: `${track}-${band}-${kind}-001`,
      track,
      band,
      kind,
      index: 1,
      title: p.title || kindLabel(kind, band, 1),
      estMinutes: estFor(kind, p.questions!.length, p.minutes),
      items: p.questions!.map((q) => ({
        type: "mockQ" as const,
        sourceId: q.id,
        packId: p.id,
      })),
    });
  }
  // Stable ids if both modes exist: listening-001 / mock-001 already distinct by kind
  return out;
}

let _cache: Lesson[] | null = null;
let _byId: Map<string, Lesson> | null = null;

function buildAll(): Lesson[] {
  const out: Lesson[] = [];
  for (const band of JP_BANDS) {
    out.push(...vocabLessons("jp", band));
    out.push(...grammarLessons("jp", band));
    out.push(...kanjiLessons(band));
    out.push(...mockLessons("jp", band));
  }
  for (const band of EN_BANDS) {
    out.push(...vocabLessons("en", band));
    out.push(...grammarLessons("en", band));
    out.push(...mockLessons("en", band));
  }
  return out;
}

function ensureCache() {
  if (!_cache) {
    _cache = buildAll();
    _byId = new Map(_cache.map((l) => [l.id, l]));
  }
}

export function allLessons(): Lesson[] {
  ensureCache();
  return _cache!;
}

export function getLesson(id: string): Lesson | null {
  ensureCache();
  return _byId!.get(id) || null;
}

export type LessonFilter = {
  track?: TrackId;
  band?: string;
  kind?: LessonKind | "all";
};

export function listLessons(filter: LessonFilter = {}): Lesson[] {
  ensureCache();
  return _cache!.filter((l) => {
    if (filter.track && l.track !== filter.track) return false;
    if (filter.band && l.band !== filter.band) return false;
    if (filter.kind && filter.kind !== "all" && l.kind !== filter.kind) return false;
    return true;
  });
}

export function lessonHref(lesson: Lesson): string {
  return `/learn/lessons/${encodeURIComponent(lesson.id)}`;
}

export function lessonFocus(kind: LessonKind): "vocab" | "grammar" | "kanji" | "listening" | "mock" {
  return kind;
}

/** Vocab source ids in a lesson (for SRS seed / day.vocabSourceIds). */
export function lessonVocabIds(lesson: Lesson): string[] {
  return lesson.items.filter((i) => i.type === "vocab").map((i) => i.sourceId);
}

/**
 * Soft first-batch size when caller passes an explicit limit.
 * Default suggest = full band coverage (enough to raise level), interleaved by kind.
 */
export function suggestLimit(intensity: PathIntensity): number {
  if (intensity === "light") return 28;
  if (intensity === "intense") return 999;
  return 56;
}

/**
 * After placement: cover the band for level-up.
 * Default (no limit): ALL vocab + grammar (+ kanji JP) + listening/mock, interleaved.
 * With limit: first N of that ordered mix (intensity soft-cap).
 */
export function suggestLessons(
  track: TrackId,
  band: string,
  goalsInput?: PathGoals | null,
  limit?: number,
): Lesson[] {
  const goals = normalizePathGoals(goalsInput);
  // Full band cover for level-up: vocab spine + grammar (+ kanji JP) + nghe/mock
  const wantKinds: LessonKind[] = ["vocab", "grammar"];
  if (track === "jp") wantKinds.push("kanji");
  wantKinds.push("listening", "mock");

  const byKind = new Map<LessonKind, Lesson[]>();
  let maxLen = 0;
  for (const k of wantKinds) {
    const list = listLessons({ track, band, kind: k });
    byKind.set(k, list);
    maxLen = Math.max(maxLen, list.length);
  }

  const out: Lesson[] = [];
  const seen = new Set<string>();
  for (let round = 0; round < maxLen; round++) {
    for (const k of wantKinds) {
      const lesson = (byKind.get(k) || [])[round];
      if (lesson && !seen.has(lesson.id)) {
        seen.add(lesson.id);
        out.push(lesson);
      }
    }
  }

  // Default: full band. Optional limit only when caller passes one.
  if (limit != null) return out.slice(0, limit);
  // Soft intensity trim only for "light" — still much larger than old 6–12
  if (goals.intensity === "light") return out.slice(0, suggestLimit("light"));
  return out;
}

export function bandsForLessons(track: TrackId): readonly string[] {
  return track === "jp" ? JP_BANDS : EN_BANDS;
}
