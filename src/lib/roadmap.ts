import grammarEn from "@/data/grammar-en.json";
import grammarJp from "@/data/grammar-jp.json";
import kanjiN1 from "@/data/openjlpt-kanji-n1.json";
import kanjiN2 from "@/data/openjlpt-kanji-n2.json";
import kanjiN3 from "@/data/openjlpt-kanji-n3.json";
import kanjiN4 from "@/data/openjlpt-kanji-n4.json";
import kanjiN5 from "@/data/openjlpt-kanji-n5.json";
import mocksEn from "@/data/mocks-en.json";
import mocksListeningEn from "@/data/mocks-listening-en.json";
import mocksListeningJp from "@/data/mocks-listening-jp.json";
import mocksJp from "@/data/mocks-jp.json";
import {
  DEFAULT_PATH_GOALS,
  estimatePathSchedule,
  newCardsPerDay,
  normalizePathGoals,
  type PathGoals,
  type PathIntensity,
  type PathScheduleEstimate,
} from "./path-goals";
import {
  getEnSeedRaw,
  getJpSeed,
  getVocabBand,
} from "./vocab-seeds";

export type { PathGoals, PathIntensity, PathScheduleEstimate };
export { estimatePathSchedule, newCardsPerDay };

export type TrackId = "jp" | "en";

export type VocabSeed = {
  id: string;
  word: string;
  reading?: string;
  romaji?: string;
  meanings: string[];
  level: string;
  pos?: string;
  examples?: { ja: string; en: string }[];
};

export type RoadmapAction = {
  id: string;
  kind: "vocab" | "kanji" | "grammar" | "mock" | "listening" | "review" | "dictionary";
  title: string;
  detail: string;
  href: string;
  count?: number;
};

export type RoadmapDayFocus =
  | "vocab"
  | "review"
  | "grammar"
  | "kanji"
  | "dictionary"
  | "listening"
  | "mock"
  | "mixed";

/** One calendar study day inside a week — what to do today (continues tomorrow, no reset). */
export type RoadmapDay = {
  day: number;
  /** 1-based day index across the whole path (for “hôm nay = ngày X”). */
  absoluteDay: number;
  title: string;
  goal: string;
  focus: RoadmapDayFocus;
  /** Soft target for new SRS cards this day (intensity). */
  newVocabTarget: number;
  samples: string[];
  /** Vocab ids planned for this day — studyQueue prefers these as “từ mới”. */
  vocabSourceIds?: string[];
  /** Lesson library id — each day = one lesson (plan v7+). */
  lessonId?: string;
  lessonKind?: "vocab" | "grammar" | "kanji" | "listening" | "mock";
  actions: RoadmapAction[];
};

/** Bump to force localStorage roadmaps to rebuild (day plans + queue wiring). */
export const ROADMAP_PLAN_VERSION = 7;

/** One selectable lesson unit from a level pool (before / while building path). */
export type LessonOffer = {
  index: number;
  id: string;
  title: string;
  wordCount: number;
  sourceIds: string[];
};

/** Split primary pool into ordered lessons (~wordsPerLesson each). */
export function listLevelLessons(
  track: TrackId,
  band: string,
  wordsPerLesson = 25,
): LessonOffer[] {
  const pool = primaryLevelPool(track, band);
  const size = Math.max(8, wordsPerLesson);
  const out: LessonOffer[] = [];
  for (let i = 0; i < pool.length; i += size) {
    const slice = pool.slice(i, i + size);
    const index = out.length;
    out.push({
      index,
      id: `${track}-${band}-L${index + 1}`,
      title: `Bài ${index + 1}`,
      wordCount: slice.length,
      sourceIds: slice.map((w) => w.id),
    });
  }
  return out;
}

export type RoadmapWeek = {
  week: number;
  title: string;
  goal: string;
  actions: RoadmapAction[];
  samples: string[];
  /** Day-by-day plan (7 days for study weeks; shorter for checkpoint weeks). */
  days?: RoadmapDay[];
};

export type RoadmapPlan = {
  track: TrackId;
  band: string;
  generatedAt: string;
  summary: string;
  inventory: {
    vocab: number;
    kanji: number;
    grammar: number;
    mocks: number;
  };
  weeks: RoadmapWeek[];
  vocabSourceIds: string[];
  /** Soft schedule — pace is flexible */
  poolSize?: number;
  newPerDay?: number;
  etaDays?: number;
  etaWeeks?: number;
  startedAt?: string;
  planVersion?: number;
};

type GrammarItem = { id: string; level: string; pattern: string };
type KanjiItem = { character: string; level: string };

const KANJI: Record<string, KanjiItem[]> = {
  N5: kanjiN5 as KanjiItem[],
  N4: kanjiN4 as KanjiItem[],
  N3: kanjiN3 as KanjiItem[],
  N2: kanjiN2 as KanjiItem[],
  N1: kanjiN1 as KanjiItem[],
};

function allJp(): VocabSeed[] {
  return getJpSeed() as VocabSeed[];
}

function allEn(): VocabSeed[] {
  return getEnSeedRaw() as VocabSeed[];
}

export function jpVocabLevels(band: string): { primary: string; bridge?: string } {
  if (band === "N5") return { primary: "N5" };
  if (band === "N4") return { primary: "N4", bridge: "N5" };
  if (band === "N3") return { primary: "N3", bridge: "N4" };
  if (band === "N2") return { primary: "N2", bridge: "N3" };
  return { primary: "N1", bridge: "N2" };
}

/** Primary CEFR level for an EN band (band id === level tag in seed). */
export function enPrimaryLevel(band: string): string {
  if (band === "A1" || band === "A2" || band === "B1" || band === "B2" || band === "C1" || band === "C2") {
    return band;
  }
  return "A2";
}

/** Full vocab pool for the primary level of a band (band must be ensureVocabBand'd). */
export function primaryLevelPool(track: TrackId, band: string): VocabSeed[] {
  if (track === "jp") {
    const { primary } = jpVocabLevels(band);
    const bandRows = getVocabBand("jp", primary) as VocabSeed[];
    if (bandRows.length) return bandRows;
    return allJp().filter((w) => w.level === primary);
  }
  const primary = enPrimaryLevel(band);
  const bandRows = getVocabBand("en", primary) as VocabSeed[];
  if (bandRows.length) return bandRows;
  return allEn().filter((w) => w.level === primary);
}

export type LevelCover = {
  primary: string;
  have: number;
  total: number;
  pct: number;
  missing: number;
};

export function levelCoverStats(
  track: TrackId,
  band: string,
  ownedSourceIds: Iterable<string>,
): LevelCover {
  const pool = primaryLevelPool(track, band);
  const haveSet = new Set(ownedSourceIds);
  const have = pool.filter((w) => haveSet.has(w.id)).length;
  const total = pool.length;
  const pct = total ? Math.round((have / total) * 100) : 0;
  return {
    primary: track === "jp" ? jpVocabLevels(band).primary : enPrimaryLevel(band),
    have,
    total,
    pct,
    missing: Math.max(0, total - have),
  };
}

/** All primary-level words not yet in deck. */
export function remainingPrimaryVocab(
  track: TrackId,
  band: string,
  excludeIds: Set<string>,
): VocabSeed[] {
  return primaryLevelPool(track, band).filter((w) => !excludeIds.has(w.id));
}

function jpKanjiLevel(band: string): string {
  if (band === "N5") return "N5";
  if (band === "N4") return "N4";
  if (band === "N3") return "N3";
  if (band === "N2") return "N2";
  return "N1";
}

function jpGrammarLevels(band: string): string[] {
  if (band === "N5") return ["N5"];
  if (band === "N4") return ["N5", "N4"];
  if (band === "N3") return ["N4", "N3"];
  if (band === "N2") return ["N3", "N2"];
  return ["N2", "N1"];
}

function enVocabLevels(band: string): string[] {
  if (band === "A1") return ["A1"];
  if (band === "A2") return ["A1", "A2"];
  if (band === "B1") return ["A2", "B1"];
  if (band === "B2") return ["B1", "B2"];
  if (band === "C1") return ["B2", "C1"];
  return ["C1", "C2"];
}

function enGrammarLevels(band: string): string[] {
  if (band === "A1") return ["A1"];
  if (band === "A2") return ["A1", "A2"];
  if (band === "B1") return ["A2", "B1"];
  if (band === "B2") return ["B1", "B2"];
  if (band === "C1") return ["B2", "C1"];
  return ["C1", "C2"];
}

function pickVocab(list: VocabSeed[], n: number): VocabSeed[] {
  return list.slice(0, Math.min(n, list.length));
}

function sampleWords(list: VocabSeed[], n = 6): string[] {
  return list.slice(0, n).map((w) => w.word);
}

function intensityScale(intensity: PathIntensity): number {
  if (intensity === "light") return 1;
  if (intensity === "intense") return 2.5;
  return 1.75;
}

function clampDeckSize(n: number, intensity: PathIntensity): number {
  const max = intensity === "light" ? 140 : intensity === "intense" ? 400 : 280;
  const min = intensity === "light" ? 60 : 80;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Vocab deck for a placement band — used to seed FSRS + roadmap counts. */
export function curriculumVocab(
  track: TrackId,
  band: string,
  intensity: PathIntensity = "standard",
): VocabSeed[] {
  const scale = intensityScale(intensity);
  if (track === "jp") {
    const all = allJp();
    const { primary, bridge } = jpVocabLevels(band);
    const primaryPool = all.filter((w) => w.level === primary);
    const bridgePool = bridge ? all.filter((w) => w.level === bridge) : [];
    const primaryBase =
      primary === "N5" ? 120 : primary === "N4" ? 100 : primary === "N3" ? 100 : 90;
    const bridgeBase = bridge ? 40 : 0;
    const primaryN = clampDeckSize(primaryBase * scale, intensity);
    const bridgeN = bridge
      ? Math.min(bridgePool.length, Math.round(bridgeBase * scale))
      : 0;
    const totalCap = clampDeckSize(primaryBase * scale + bridgeBase * scale, intensity);
    const primaryTake = Math.min(primaryPool.length, Math.max(0, totalCap - bridgeN));
    return [
      ...pickVocab(bridgePool, bridgeN),
      ...pickVocab(primaryPool, Math.min(primaryN, primaryTake)),
    ];
  }
  const levels = new Set(enVocabLevels(band));
  const pool = allEn().filter((w) => levels.has(w.level));
  const base =
    band === "A1"
      ? 70
      : band === "A2"
        ? 80
        : band === "B1"
          ? 100
          : band === "B2"
            ? 120
            : band === "C1"
              ? 140
              : 160;
  const n = clampDeckSize(base * scale, intensity);
  return pickVocab(pool.length ? pool : allEn(), n);
}

/** Extra words for “nạp thêm” — skips ids already in deck. */
export function moreCurriculumVocab(
  track: TrackId,
  band: string,
  excludeIds: Set<string>,
  intensity: PathIntensity = "standard",
  batch = 40,
): VocabSeed[] {
  const want = intensity === "light" ? Math.min(batch, 24) : intensity === "intense" ? Math.max(batch, 60) : batch;
  if (track === "jp") {
    const { primary, bridge } = jpVocabLevels(band);
    const levels = new Set([primary, ...(bridge ? [bridge] : [])]);
    return allJp()
      .filter((w) => levels.has(w.level) && !excludeIds.has(w.id))
      .slice(0, want);
  }
  const levels = new Set(enVocabLevels(band));
  return allEn()
    .filter((w) => levels.has(w.level) && !excludeIds.has(w.id))
    .slice(0, want);
}

function renumberWeeks(weeks: RoadmapWeek[]): RoadmapWeek[] {
  return weeks.map((w, i) => ({ ...w, week: i + 1 }));
}

function cloneWeek(w: RoadmapWeek): RoadmapWeek {
  return {
    ...w,
    actions: w.actions.map((a) => ({ ...a })),
    samples: [...(w.samples || [])],
    days: w.days?.map((d) => ({
      ...d,
      samples: [...(d.samples || [])],
      vocabSourceIds: d.vocabSourceIds ? [...d.vocabSourceIds] : undefined,
      actions: d.actions.map((a) => ({ ...a })),
    })),
  };
}

type DayBuildCtx = {
  track: TrackId;
  band: string;
  primary: string;
  newPerDay: number;
  absStart: number;
  grammarHref: string;
  grammarDetail: string;
  grammarCount: number;
  kanjiHref?: string;
  kanjiDetail?: string;
  kanjiCount?: number;
  dictHref: string;
  dictDetail: string;
};

/**
 * Split a unit’s vocab into sequential lessons (bài học).
 * Pool → chunks → lessons. Finish bài N → unlock bài N+1 (same day OK).
 * Not a vocab/grammar catalog — one study unit at a time.
 */
/** Human label for a day focus — never show JP-only terms on EN (and vice versa). */
export function dayFocusLabel(
  focus: RoadmapDayFocus | string,
  track: TrackId,
): string {
  const f = focus === "kanji" && track === "en" ? "vocab" : focus;
  if (f === "grammar") return "Ngữ pháp + từ";
  if (f === "kanji") return "Kanji + từ";
  if (f === "dictionary") return "Tra cứu + từ";
  if (f === "review") return "Củng cố";
  if (f === "mixed") return "Tổng hợp";
  if (f === "listening") return "Nghe + từ";
  if (f === "mock") return "Mock + từ";
  if (f === "vocab") return "Từ mới";
  return String(f);
}

/** Normalize stored day title/focus for display (fixes old EN paths that said “kanji”). */
export function displayDayTitle(day: RoadmapDay, track: TrackId): string {
  let title = day.title || "";
  if (track === "en") {
    title = title
      .replace(/\bkanji\b/gi, "từ vựng")
      .replace(/Kanji\s*\+\s*từ/gi, "Từ vựng")
      .replace(/Bổ trợ · kanji/gi, "Bổ trợ · từ");
  }
  return title;
}

function fociForTrack(track: TrackId): RoadmapDayFocus[] {
  if (track === "jp") {
    return ["vocab", "dictionary", "kanji", "grammar", "review", "vocab", "mixed"];
  }
  // EN: no kanji — use grammar / listening / review instead
  return ["vocab", "dictionary", "grammar", "review", "vocab", "listening", "mixed"];
}

function buildVocabWeekDays(
  week: number,
  chunk: VocabSeed[],
  ctx: DayBuildCtx,
): RoadmapDay[] {
  const per = Math.max(1, ctx.newPerDay);
  const lessonsPerUnit = Math.max(1, Math.min(7, Math.ceil(chunk.length / per)));
  const slices = chunkPool(chunk, lessonsPerUnit);
  const reviewHref = `/learn/review?track=${ctx.track}`;
  const foci = fociForTrack(ctx.track);

  return slices.map((slice, i) => {
    const day = i + 1;
    let focus = foci[i] || "vocab";
    // Safety: never assign kanji on EN even if foci misconfigured
    if (ctx.track === "en" && focus === "kanji") focus = "grammar";
    const lessonSize = slice.length;
    const focusLabel = dayFocusLabel(focus, ctx.track);

    const actions: RoadmapAction[] = [
      {
        id: `w${week}-d${day}-review`,
        kind: "review",
        title: `Học bài ${day}`,
        detail: `${lessonSize} từ trong bài · xong có thể học bài tiếp ngay`,
        href: reviewHref,
        count: lessonSize,
      },
    ];

    // One light skill link — not a catalog dump
    if (focus === "dictionary" || focus === "mixed") {
      actions.push({
        id: `w${week}-d${day}-dict`,
        kind: "dictionary",
        title: "Bổ trợ · tra từ",
        detail: ctx.dictDetail,
        href: ctx.dictHref,
      });
    } else if (focus === "kanji" && ctx.track === "jp" && ctx.kanjiHref) {
      actions.push({
        id: `w${week}-d${day}-kanji`,
        kind: "kanji",
        title: "Bổ trợ · kanji",
        detail: ctx.kanjiDetail || "",
        href: ctx.kanjiHref,
      });
    } else if (focus === "grammar") {
      actions.push({
        id: `w${week}-d${day}-grammar`,
        kind: "grammar",
        title: "Bổ trợ · ngữ pháp",
        detail: ctx.grammarDetail,
        href: ctx.grammarHref,
      });
    } else if (focus === "listening") {
      actions.push({
        id: `w${week}-d${day}-listen`,
        kind: "listening",
        title: "Bổ trợ · nghe",
        detail: `Listening ${ctx.band}`,
        href: `/learn/mocks?track=${ctx.track}&band=${encodeURIComponent(ctx.band)}&mode=listening`,
      });
    }

    return {
      day,
      absoluteDay: ctx.absStart + i,
      title: `Bài ${day} · ${focusLabel}`,
      goal:
        lessonSize > 0
          ? `Bài học ${lessonSize} từ · hoàn thành rồi sang bài ${day < 7 ? day + 1 : "tiếp"} (không khóa theo ngày lịch).`
          : `Ôn củng cố · ${ctx.primary}.`,
      focus,
      newVocabTarget: lessonSize,
      samples: [], // path shows lessons, not word catalog
      vocabSourceIds: slice.map((w) => w.id),
      actions,
    };
  });
}

function dayBuildCtxFor(
  track: TrackId,
  band: string,
  absStart: number,
  newPerDay: number,
): DayBuildCtx {
  const primary = track === "jp" ? jpVocabLevels(band).primary : enPrimaryLevel(band);
  if (track === "jp") {
    const kLevel = jpKanjiLevel(band);
    const gLevels = jpGrammarLevels(band);
    const kanjiBank = KANJI[kLevel] || [];
    const grammar = (grammarJp as GrammarItem[]).filter((g) => gLevels.includes(g.level));
    return {
      track,
      band,
      primary,
      newPerDay,
      absStart,
      grammarHref: `/learn/grammar?track=jp&level=${gLevels[gLevels.length - 1]}`,
      grammarDetail: grammar.map((g) => g.pattern).slice(0, 4).join(" · ") || "Grammar",
      grammarCount: grammar.length,
      kanjiHref: `/learn/kanji?level=${kLevel}`,
      kanjiDetail: `${kanjiBank.length} chữ ${kLevel}`,
      kanjiCount: kanjiBank.length,
      dictHref: "/learn/dictionary?track=jp",
      dictDetail: `OpenJLPT · ${primary}`,
    };
  }
  const gLevels = enGrammarLevels(band);
  const grammar = (grammarEn as GrammarItem[]).filter((g) => gLevels.includes(g.level));
  return {
    track,
    band,
    primary,
    newPerDay,
    absStart,
    grammarHref: `/learn/grammar?track=en&level=${gLevels[gLevels.length - 1]}`,
    grammarDetail: grammar.map((g) => g.pattern).slice(0, 4).join(" · "),
    grammarCount: grammar.length,
    dictHref: "/learn/dictionary?track=en",
    dictDetail: `CEFR ${primary}`,
  };
}

/** Build one chapter (tuần/chương) from a vocab slice — used for incremental path build. */
export function buildChapterWeek(
  track: TrackId,
  band: string,
  week: number,
  vocab: VocabSeed[],
  absStart: number,
  goals?: PathGoals | null,
): RoadmapWeek {
  const g = normalizePathGoals(goals || DEFAULT_PATH_GOALS);
  const newPerDay = newCardsPerDay(g.intensity);
  const ctx = dayBuildCtxFor(track, band, absStart, newPerDay);
  const days = buildVocabWeekDays(week, vocab, ctx);
  const primary = ctx.primary;
  return {
    week,
    title: `Chương ${week} · ${primary} · ${days.length} bài`,
    goal: `${vocab.length} từ trong ${days.length} bài nối tiếp · thêm dần theo nhu cầu.`,
    samples: [],
    actions: [
      {
        id: `w${week}-review`,
        kind: "review",
        title: `Học bài trong chương ${week}`,
        detail: `${vocab.length} từ · ${days.length} bài`,
        href: `/learn/review?track=${track}`,
        count: vocab.length,
      },
    ],
    days,
  };
}

type LessonLike = {
  id: string;
  track: TrackId;
  band: string;
  kind: "vocab" | "grammar" | "kanji" | "listening" | "mock";
  title: string;
  estMinutes: number;
  items: { type: string; sourceId: string }[];
};

/** Map lessons → path days (1 lesson = 1 day). Groups into chapters of up to 7. */
export function buildWeeksFromLessons(
  track: TrackId,
  band: string,
  lessons: LessonLike[],
  weekStart: number,
  absStart: number,
): RoadmapWeek[] {
  if (!lessons.length) return [];
  const weeks: RoadmapWeek[] = [];
  const groups: LessonLike[][] = [];
  for (let i = 0; i < lessons.length; i += 7) {
    groups.push(lessons.slice(i, i + 7));
  }
  let abs = absStart;
  groups.forEach((group, gi) => {
    const week = weekStart + gi;
    const days: RoadmapDay[] = group.map((lesson, di) => {
      const day = di + 1;
      const vocabIds = lesson.items
        .filter((it) => it.type === "vocab")
        .map((it) => it.sourceId);
      const href = `/learn/lessons/${encodeURIComponent(lesson.id)}`;
      const actionKind =
        lesson.kind === "listening"
          ? ("listening" as const)
          : lesson.kind === "mock"
            ? ("mock" as const)
            : lesson.kind === "grammar"
              ? ("grammar" as const)
              : lesson.kind === "kanji"
                ? ("kanji" as const)
                : ("review" as const);
      return {
        day,
        absoluteDay: abs + di,
        title: lesson.title,
        goal: `${lesson.estMinutes} phút · xong bài này có thể học bài tiếp.`,
        focus: lesson.kind === "vocab" ? "vocab" : lesson.kind,
        newVocabTarget: vocabIds.length,
        samples: [],
        vocabSourceIds: vocabIds.length ? vocabIds : undefined,
        lessonId: lesson.id,
        lessonKind: lesson.kind,
        actions: [
          {
            id: `w${week}-d${day}-lesson`,
            kind: actionKind,
            title: `Học · ${lesson.title}`,
            detail: `${lesson.items.length} mục · ${lesson.kind}`,
            href,
            count: lesson.items.length,
          },
        ],
      };
    });
    abs += group.length;
    weeks.push({
      week,
      title: `Chương ${week} · ${band} · ${days.length} bài`,
      goal: `${days.length} bài từ thư viện · nối tiếp trong chương.`,
      samples: [],
      actions: [
        {
          id: `w${week}-open`,
          kind: "review",
          title: `Học chương ${week}`,
          detail: `${days.length} bài`,
          href: days[0]?.actions[0]?.href || `/learn?track=${track}`,
          count: days.length,
        },
      ],
      days,
    });
  });
  return weeks;
}

function buildCheckpointDays(
  week: number,
  absStart: number,
  track: TrackId,
  band: string,
  newPerDay: number,
  mode: "listen" | "mock" | "both",
  listenQ: number,
  mockQ: number,
): RoadmapDay[] {
  const reviewHref = `/learn/review?track=${track}`;
  const days: RoadmapDay[] = [];
  let d = 0;
  const pushReview = (title: string, goal: string) => {
    d += 1;
    days.push({
      day: d,
      absoluteDay: absStart + d - 1,
      title,
      goal,
      focus: "review",
      newVocabTarget: 0,
      samples: [],
      actions: [
        {
          id: `w${week}-d${d}-review`,
          kind: "review",
          title: "Ôn due trước bài kiểm",
          detail: "Ôn lại thẻ đến hạn",
          href: reviewHref,
          count: Math.min(10, newPerDay),
        },
      ],
    });
  };

  if (mode === "listen" || mode === "both") {
    pushReview(`Bài ôn · trước nghe`, "Ôn due rồi vào bài nghe.");
    d += 1;
    days.push({
      day: d,
      absoluteDay: absStart + d - 1,
      title: `Bài nghe`,
      goal: `Listening mock · ${listenQ} câu.`,
      focus: "listening",
      newVocabTarget: 0,
      samples: [],
      actions: [
        {
          id: `w${week}-d${d}-listen`,
          kind: "listening",
          title: "Làm bài nghe",
          detail: `${listenQ} câu`,
          href: `/learn/mocks?track=${track}&mode=listening&band=${encodeURIComponent(band)}`,
          count: listenQ,
        },
      ],
    });
  }
  if (mode === "mock" || mode === "both") {
    if (mode === "mock") pushReview(`Bài ôn · trước mock`, "Ôn due rồi vào mock vocab.");
    d += 1;
    days.push({
      day: d,
      absoluteDay: absStart + d - 1,
      title: `Bài mock vocab`,
      goal: `Vocab mock · ${mockQ} câu · dùng để xét promote.`,
      focus: "mock",
      newVocabTarget: 0,
      samples: [],
      actions: [
        {
          id: `w${week}-d${d}-mock`,
          kind: "mock",
          title: "Làm mock vocab",
          detail: `${mockQ} câu`,
          href: `/learn/mocks?track=${track}&mode=vocab&band=${encodeURIComponent(band)}`,
          count: mockQ,
        },
      ],
    });
  }
  return days;
}

/** Personalize static weeks from goals (intensity / focus / skills). */
export function applyPathGoals(
  track: TrackId,
  weeks: RoadmapWeek[],
  goalsInput?: PathGoals | null,
): RoadmapWeek[] {
  const goals = normalizePathGoals(goalsInput || DEFAULT_PATH_GOALS);
  let next = weeks.map(cloneWeek);

  // Intensity: trim study weeks but keep terminal mock/listening checkpoints
  if (goals.intensity === "light") {
    const terminal = next.filter((w) =>
      w.actions.some((a) => a.kind === "mock" || a.kind === "listening"),
    );
    const study = next.filter(
      (w) => !w.actions.some((a) => a.kind === "mock" || a.kind === "listening"),
    );
    const keepStudy = Math.max(2, Math.ceil(study.length * 0.67));
    next = [...study.slice(0, keepStudy), ...terminal];
  } else if (goals.intensity === "intense") {
    next = next.map((w) => {
      const hasReview = w.actions.some((a) => a.kind === "review");
      if (hasReview) return w;
      return {
        ...w,
        actions: [
          ...w.actions,
          {
            id: `${w.actions[0]?.id || `w${w.week}`}-extra-review`,
            kind: "review" as const,
            title: "Ôn SRS thêm",
            detail: "Cường độ cao · giữ nhịp mỗi ngày",
            href: `/learn/review?track=${track}`,
          },
        ],
        days: w.days,
      };
    });
  }

  // Listening priority: move listening weeks earlier
  if (goals.skills.includes("listening")) {
    const listen = next.filter((w) => w.actions.some((a) => a.kind === "listening"));
    const rest = next.filter((w) => !w.actions.some((a) => a.kind === "listening"));
    if (listen.length) {
      const insertAt = Math.min(1, rest.length);
      next = [...rest.slice(0, insertAt), ...listen, ...rest.slice(insertAt)];
    }
  }

  // Focus tweaks
  if (goals.focus === "daily" || goals.focus === "business") {
    next = next.map((w) => {
      const sorted = [...w.actions].sort((a, b) => {
        const score = (k: string) =>
          k === "review" || k === "vocab" || k === "dictionary" ? 0 : 1;
        return score(a.kind) - score(b.kind);
      });
      return { ...w, actions: sorted };
    });
  }
  if (goals.focus === "jlpt" || goals.focus === "exam_en") {
    next = next.map((w) => {
      const sorted = [...w.actions].sort((a, b) => {
        const score = (k: string) =>
          k === "mock" || k === "listening" || k === "grammar" ? 0 : 1;
        return score(a.kind) - score(b.kind);
      });
      return { ...w, actions: sorted };
    });
  }

  // Drop dictionary-only soft actions on light paths to keep checklist tight
  if (goals.intensity === "light") {
    next = next.map((w) => ({
      ...w,
      actions: w.actions.filter((a) => a.kind !== "dictionary" || w.actions.length <= 1),
    }));
  }

  return renumberWeeks(next);
}

function chunkPool<T>(list: T[], weekCount: number): T[][] {
  const n = Math.max(1, weekCount);
  const size = Math.ceil(list.length / n) || 1;
  const chunks: T[][] = [];
  for (let i = 0; i < n; i++) {
    chunks.push(list.slice(i * size, (i + 1) * size));
  }
  return chunks;
}

export function buildRoadmap(
  track: TrackId,
  band: string,
  goals?: PathGoals | null,
  opts?: { startedAt?: string },
): RoadmapPlan {
  const generatedAt = new Date().toISOString();
  const g = normalizePathGoals(goals || DEFAULT_PATH_GOALS);
  const pool = primaryLevelPool(track, band);
  const schedule = estimatePathSchedule(pool.length, g.intensity);
  const vocabSourceIds = pool.map((w) => w.id);
  const base =
    track === "jp"
      ? buildJpRoadmap(band, pool, vocabSourceIds, generatedAt, schedule)
      : buildEnRoadmap(band, pool, vocabSourceIds, generatedAt, schedule);
  const weeks = applyPathGoals(track, base.weeks, g);
  const focusNote =
    g.focus === "jlpt"
      ? "hướng JLPT"
      : g.focus === "exam_en"
        ? "hướng thi EN"
        : g.focus === "business"
          ? "hướng công việc"
          : "học hàng ngày";
  return {
    ...base,
    weeks,
    poolSize: schedule.poolSize,
    newPerDay: schedule.newPerDay,
    etaDays: schedule.etaDays,
    etaWeeks: schedule.etaWeeks,
    startedAt: opts?.startedAt || base.startedAt || generatedAt,
    planVersion: ROADMAP_PLAN_VERSION,
    summary: `${base.summary} Cá nhân hóa: ${focusNote}, ~${schedule.newPerDay} từ mới/ngày, ETA ~${schedule.etaWeeks} tuần (nhịp tự do).`,
  };
}

function buildJpRoadmap(
  band: string,
  vocab: VocabSeed[],
  vocabSourceIds: string[],
  generatedAt: string,
  schedule: PathScheduleEstimate,
): RoadmapPlan {
  const { primary } = jpVocabLevels(band);
  const kLevel = jpKanjiLevel(band);
  const gLevels = jpGrammarLevels(band);
  const kanjiBank = KANJI[kLevel] || [];
  const grammar = (grammarJp as GrammarItem[]).filter((g) => gLevels.includes(g.level));
  const mockQ = (mocksJp as { questions?: unknown[] }).questions?.length || 0;
  const listenQ =
    (mocksListeningJp as { questions?: unknown[] }).questions?.length || 0;
  const grammarDetail =
    grammar
      .map((g) => g.pattern)
      .slice(0, 4)
      .join(" · ") || "Drills theo level";
  const grammarHref = `/learn/grammar?track=jp&level=${gLevels[gLevels.length - 1]}`;

  const studyWeeks = Math.max(2, schedule.etaWeeks - 2);
  const chunks = chunkPool(vocab, studyWeeks);
  let absDay = 1;
  const weeks: RoadmapWeek[] = chunks.map((chunk, i) => {
    const week = i + 1;
    const days = buildVocabWeekDays(week, chunk, {
      track: "jp",
      band,
      primary,
      newPerDay: schedule.newPerDay,
      absStart: absDay,
      grammarHref,
      grammarDetail,
      grammarCount: grammar.length,
      kanjiHref: `/learn/kanji?level=${kLevel}`,
      kanjiDetail: `${kanjiBank.length} chữ ${kLevel}`,
      kanjiCount: kanjiBank.length,
      dictHref: "/learn/dictionary?track=jp",
      dictDetail: `OpenJLPT · ${primary}`,
    });
    absDay += days.length;
    const actions: RoadmapAction[] = [
      {
        id: `w${week}-review`,
        kind: "review",
        title: `Học bài trong chương ${week}`,
        detail: `${chunk.length} từ chia 7 bài · xong bài này sang bài tiếp (không khóa lịch ngày)`,
        href: "/learn/review?track=jp",
        count: chunk.length,
      },
      {
        id: `w${week}-skill`,
        kind: week % 3 === 2 ? "kanji" : week % 3 === 0 ? "grammar" : "dictionary",
        title:
          week % 3 === 2
            ? `Bổ trợ kanji ${kLevel}`
            : week % 3 === 0
              ? "Bổ trợ grammar"
              : "Bổ trợ dictionary",
        detail:
          week % 3 === 2
            ? `${kanjiBank.length} chữ`
            : week % 3 === 0
              ? grammarDetail
              : `Tập trung ${primary}`,
        href:
          week % 3 === 2
            ? `/learn/kanji?level=${kLevel}`
            : week % 3 === 0
              ? grammarHref
              : "/learn/dictionary?track=jp",
        count: week % 3 === 2 ? kanjiBank.length : week % 3 === 0 ? grammar.length : undefined,
      },
    ];
    return {
      week,
      title: `Chương ${week} · ${primary} · 7 bài`,
      goal: `Cấp ${primary} chia thành bài học nối tiếp. Xong bài 1 → học bài 2 ngay (ETA mềm ~${schedule.newPerDay} từ/ngày chỉ để ước lượng).`,
      samples: [],
      actions,
      days,
    };
  });

  const wListen = studyWeeks + 1;
  const listenDays = buildCheckpointDays(
    wListen,
    absDay,
    "jp",
    band,
    schedule.newPerDay,
    "listen",
    listenQ,
    mockQ,
  );
  absDay += listenDays.length;
  weeks.push({
    week: wListen,
    title: "Tuần nghe (TTS)",
    goal: `Chia ngày: ôn → listening mock (${listenQ} câu).`,
    samples: [],
    actions: listenDays.flatMap((d) => d.actions),
    days: listenDays,
  });

  const wMock = studyWeeks + 2;
  const mockDays = buildCheckpointDays(
    wMock,
    absDay,
    "jp",
    band,
    schedule.newPerDay,
    "mock",
    listenQ,
    mockQ,
  );
  weeks.push({
    week: wMock,
    title: "Tuần checkpoint mock",
    goal: `Chia ngày: ôn → vocab mock (${mockQ} câu) · mastery quyết định promote.`,
    samples: [],
    actions: mockDays.flatMap((d) => d.actions),
    days: mockDays,
  });

  return {
    track: "jp",
    band,
    generatedAt,
    startedAt: generatedAt,
    summary: `Lộ trình ${band} full primary: ${vocab.length} từ · chia ~${schedule.newPerDay}/ngày × ~${schedule.etaDays} ngày (ETA ~${schedule.etaWeeks} tuần, nhịp tự do).`,
    inventory: {
      vocab: vocab.length,
      kanji: kanjiBank.length,
      grammar: grammar.length,
      mocks: 2,
    },
    weeks: renumberWeeks(weeks),
    vocabSourceIds,
    poolSize: schedule.poolSize,
    newPerDay: schedule.newPerDay,
    etaDays: schedule.etaDays,
    etaWeeks: schedule.etaWeeks,
    planVersion: ROADMAP_PLAN_VERSION,
  };
}

function buildEnRoadmap(
  band: string,
  vocab: VocabSeed[],
  vocabSourceIds: string[],
  generatedAt: string,
  schedule: PathScheduleEstimate,
): RoadmapPlan {
  const primary = enPrimaryLevel(band);
  const gLevels = enGrammarLevels(band);
  const grammar = (grammarEn as GrammarItem[]).filter((g) => gLevels.includes(g.level));
  const mockQ = (mocksEn as { questions?: unknown[] }).questions?.length || 0;
  const listenQ =
    (mocksListeningEn as { questions?: unknown[] }).questions?.length || 0;
  const grammarDetail = grammar
    .map((g) => g.pattern)
    .slice(0, 4)
    .join(" · ");
  const grammarHref = `/learn/grammar?track=en&level=${gLevels[gLevels.length - 1]}`;

  const studyWeeks = Math.max(2, schedule.etaWeeks - 1);
  const chunks = chunkPool(vocab, studyWeeks);
  let absDay = 1;
  const weeks: RoadmapWeek[] = chunks.map((chunk, i) => {
    const week = i + 1;
    const days = buildVocabWeekDays(week, chunk, {
      track: "en",
      band,
      primary,
      newPerDay: schedule.newPerDay,
      absStart: absDay,
      grammarHref,
      grammarDetail,
      grammarCount: grammar.length,
      dictHref: "/learn/dictionary?track=en",
      dictDetail: `CEFR ${primary}`,
    });
    absDay += days.length;
    return {
      week,
      title: `Chương ${week} · ${primary} · 7 bài`,
      goal: `Cấp ${primary} chia thành bài học nối tiếp. Xong một bài → học bài tiếp ngay (ETA mềm chỉ ước lượng).`,
      samples: [],
      actions: [
        {
          id: `w${week}-review`,
          kind: "review",
          title: `Học bài trong chương ${week}`,
          detail: `${chunk.length} từ chia 7 bài · không khóa theo ngày lịch`,
          href: "/learn/review?track=en",
          count: chunk.length,
        },
        {
          id: `w${week}-skill`,
          kind: week % 2 === 0 ? "grammar" : "dictionary",
          title: week % 2 === 0 ? "Bổ trợ grammar" : "Bổ trợ dictionary",
          detail: week % 2 === 0 ? grammarDetail : `CEFR ${primary}`,
          href: week % 2 === 0 ? grammarHref : "/learn/dictionary?track=en",
          count: week % 2 === 0 ? grammar.length : undefined,
        },
      ],
      days,
    };
  });

  const wFinal = studyWeeks + 1;
  const finalDays = buildCheckpointDays(
    wFinal,
    absDay,
    "en",
    band,
    schedule.newPerDay,
    "both",
    listenQ,
    mockQ,
  );
  weeks.push({
    week: wFinal,
    title: "Tuần nghe + mock",
    goal: `Chia ngày: ôn → nghe → vocab mock.`,
    samples: [],
    actions: finalDays.flatMap((d) => d.actions),
    days: finalDays,
  });

  return {
    track: "en",
    band,
    generatedAt,
    startedAt: generatedAt,
    summary: `Lộ trình ${band} full primary: ${vocab.length} từ · ~${schedule.newPerDay}/ngày · ETA ~${schedule.etaWeeks} tuần.`,
    inventory: {
      vocab: vocab.length,
      kanji: 0,
      grammar: grammar.length,
      mocks: 2,
    },
    weeks: renumberWeeks(weeks),
    vocabSourceIds,
    poolSize: schedule.poolSize,
    newPerDay: schedule.newPerDay,
    etaDays: schedule.etaDays,
    etaWeeks: schedule.etaWeeks,
    planVersion: ROADMAP_PLAN_VERSION,
  };
}
