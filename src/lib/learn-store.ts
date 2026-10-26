"use client";

import { FREE_LIMITS, freemiumUnlocked } from "./freemium";
import {
  coerceSnapshot,
  deserializeCard,
  newCard,
  Rating,
  schedule,
  serializeCard,
  type CardSnapshot,
  type Grade,
} from "./fsrs";
import { STORAGE_KEYS } from "./storage-keys";
import { loadSession } from "./session";
import jpSeedN5 from "@/data/openjlpt-n5-seed.json";
import jpSeedN4 from "@/data/openjlpt-n4-seed.json";
import jpSeedN3 from "@/data/openjlpt-n3-seed.json";
import jpSeedN2 from "@/data/openjlpt-n2-seed.json";
import jpSeedN1 from "@/data/openjlpt-n1-seed.json";
import enSeed from "@/data/cefrj-vocab-seed.json";
import {
  DEFAULT_PATH_GOALS,
  estimatePathSchedule,
  newCardsPerDay,
  normalizePathGoals,
  type PathGoals,
  type PathIntensity,
} from "./path-goals";
import {
  buildPathAdvice,
  emptyEvidence,
  EVIDENCE,
  evidenceCreditForKind,
  gradeKey,
  normalizeEvidence,
  type PathAdvice,
  type PathEvidence,
} from "./path-evidence";
import {
  getLesson,
  lessonVocabIds,
  listLessons,
  suggestLessons,
  type Lesson,
} from "./lessons";
import {
  buildRoadmap,
  buildWeeksFromLessons,
  levelCoverStats,
  moreCurriculumVocab,
  primaryLevelPool,
  remainingPrimaryVocab,
  ROADMAP_PLAN_VERSION,
  type LevelCover,
  type RoadmapDay,
  type RoadmapPlan,
  type RoadmapWeek,
  type VocabSeed,
} from "./roadmap";
import { shiftBand } from "./placement";
import { displayMeanings, getVocabGlossVi } from "./gloss-vi";

export type TrackId = "jp" | "en";
export type JpBand = "N5" | "N4" | "N3" | "N2" | "N1";
export type EnBand = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type { VocabSeed, RoadmapPlan, PathGoals, PathEvidence, PathAdvice };
export { EVIDENCE } from "./path-evidence";
export { newCardsPerDay, estimatePathSchedule };

/** Min share of Good/Easy in a vocab lesson before the day can pass. */
export const LESSON_PASS_GOOD_RATIO = 0.7;

/** Persisted: sourceId + FSRS. word/meanings optional (legacy) — hydrate from seed. */
export type SerializedCard = {
  sourceId: string;
  track: TrackId;
  word?: string;
  reading?: string;
  meanings?: string[];
  exampleJa?: string;
  exampleEn?: string;
  card: CardSnapshot;
  /** Last SRS grade (1 Again … 4 Easy) — used for lesson pass quality. */
  lastGrade?: number;
};

export type HydratedCard = SerializedCard & {
  word: string;
  meanings: string[];
};

export type ActionProgressEntry = {
  doneAt: string;
  score?: number;
};

export type DayActivity = {
  day: string;
  minutes: number;
  reviews: number;
  actions: number;
};

export type TrackState = {
  band: string | null;
  placementDone: boolean;
  pathActive: boolean;
  cards: SerializedCard[];
  roadmap: RoadmapPlan | null;
  actionProgress: Record<string, ActionProgressEntry>;
  pathGoals: PathGoals | null;
  /** Real study signals — used to gate progress (anti-skip). */
  evidence: PathEvidence;
  /** ISO date when current path band was activated (pace vs ETA). */
  pathStartedAt?: string | null;
  /** Lesson library completion (browse or path). */
  lessonProgress?: Record<string, { doneAt: string }>;
};

/** Bump to wipe JP/EN path progress once (user-requested fresh start). */
export const LEARN_PATHS_EPOCH = 8;

/** Beginner goals: zero → N5 / A1. */
export const BEGINNER_JP_GOALS: PathGoals = {
  focus: "jlpt",
  skills: ["vocab", "grammar", "listening"],
  intensity: "standard",
};
export const BEGINNER_EN_GOALS: PathGoals = {
  focus: "exam_en",
  skills: ["vocab", "grammar", "listening"],
  intensity: "standard",
};

export type LearnState = {
  preferredTrack: TrackId;
  jp: TrackState;
  en: TrackState;
  reviewsToday: number;
  /** New cards (reps 0→1) introduced today — separate from due reviews. */
  newCardsToday: number;
  lookupsToday: number;
  dayKey: string;
  mocksThisMonth: number;
  mockMonthKey: string;
  activityLog: DayActivity[];
  /** When !== LEARN_PATHS_EPOCH, JP/EN tracks are cleared on load. */
  pathsEpoch?: number;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function emptyTrack(): TrackState {
  return {
    band: null,
    placementDone: false,
    pathActive: false,
    cards: [],
    roadmap: null,
    actionProgress: {},
    pathGoals: null,
    evidence: emptyEvidence(),
    pathStartedAt: null,
    lessonProgress: {},
  };
}

function defaultLearn(): LearnState {
  return {
    preferredTrack: "jp",
    jp: emptyTrack(),
    en: emptyTrack(),
    reviewsToday: 0,
    newCardsToday: 0,
    lookupsToday: 0,
    dayKey: todayKey(),
    mocksThisMonth: 0,
    mockMonthKey: monthKey(),
    activityLog: [],
    pathsEpoch: LEARN_PATHS_EPOCH,
  };
}

function ensureTrackFields(t: TrackState): TrackState {
  return {
    ...t,
    actionProgress: t.actionProgress && typeof t.actionProgress === "object" ? t.actionProgress : {},
    pathGoals: t.pathGoals ? normalizePathGoals(t.pathGoals) : null,
    evidence: normalizeEvidence(t.evidence),
    pathStartedAt: t.pathStartedAt || t.roadmap?.startedAt || null,
    lessonProgress:
      t.lessonProgress && typeof t.lessonProgress === "object" ? t.lessonProgress : {},
  };
}

function migrate(raw: Record<string, unknown>): LearnState {
  const base = defaultLearn();
  if (raw.jp || raw.en) {
    const state = normalize({ ...base, ...(raw as unknown as LearnState) });
    state.jp.cards = state.jp.cards.map((c) => ({
      ...c,
      card: coerceSnapshot(c.card as CardSnapshot),
    }));
    state.en.cards = state.en.cards.map((c) => ({
      ...c,
      card: coerceSnapshot(c.card as CardSnapshot),
    }));
    return state;
  }
  const cards = Array.isArray(raw.cards) ? (raw.cards as SerializedCard[]) : [];
  return normalize({
    ...base,
    preferredTrack: "jp",
    jp: {
      band: (raw.placementBand as string) || null,
      placementDone: Boolean(raw.placementDone),
      pathActive: Boolean(raw.pathActive),
      cards: cards.map((c) => ({
        ...c,
        track: "jp" as const,
        card: coerceSnapshot(c.card as CardSnapshot),
      })),
      roadmap: null,
      actionProgress: {},
      pathGoals: null,
      evidence: emptyEvidence(),
    },
    activityLog: [],
    reviewsToday: Number(raw.reviewsToday) || 0,
    lookupsToday: Number(raw.lookupsToday) || 0,
    dayKey: String(raw.dayKey || todayKey()),
  });
}

function normalize(state: LearnState): LearnState {
  let next = { ...state };
  if (!next.jp) next.jp = emptyTrack();
  if (!next.en) next.en = emptyTrack();
  next.jp = ensureTrackFields({
    ...next.jp,
    roadmap: next.jp.roadmap === undefined ? null : next.jp.roadmap,
  });
  next.en = ensureTrackFields({
    ...next.en,
    roadmap: next.en.roadmap === undefined ? null : next.en.roadmap,
  });
  if (!Array.isArray(next.activityLog)) next.activityLog = [];
  if (typeof next.newCardsToday !== "number") next.newCardsToday = 0;
  if (next.dayKey !== todayKey()) {
    next = {
      ...next,
      dayKey: todayKey(),
      reviewsToday: 0,
      newCardsToday: 0,
      lookupsToday: 0,
    };
  }
  // One-shot path wipe (epoch bump) — keeps desk; clears JP/EN learn progress.
  if (next.pathsEpoch !== LEARN_PATHS_EPOCH) {
    next = {
      ...next,
      jp: emptyTrack(),
      en: emptyTrack(),
      reviewsToday: 0,
      newCardsToday: 0,
      lookupsToday: 0,
      activityLog: [],
      pathsEpoch: LEARN_PATHS_EPOCH,
    };
  }
  if (next.mockMonthKey !== monthKey()) {
    next = { ...next, mockMonthKey: monthKey(), mocksThisMonth: 0 };
  }
  return next;
}

function bumpActivity(
  state: LearnState,
  patch: Partial<Pick<DayActivity, "minutes" | "reviews" | "actions">>,
): LearnState {
  const day = todayKey();
  const log = [...(state.activityLog || [])];
  const idx = log.findIndex((d) => d.day === day);
  const base: DayActivity =
    idx >= 0 ? log[idx] : { day, minutes: 0, reviews: 0, actions: 0 };
  const row: DayActivity = {
    day,
    minutes: Math.min(24 * 60, base.minutes + (patch.minutes || 0)),
    reviews: base.reviews + (patch.reviews || 0),
    actions: base.actions + (patch.actions || 0),
  };
  if (idx >= 0) log[idx] = row;
  else log.push(row);
  log.sort((a, b) => a.day.localeCompare(b.day));
  return { ...state, activityLog: log.slice(-60) };
}

function isProUser() {
  return loadSession()?.plan === "pro";
}

export function loadLearn(): LearnState {
  if (typeof window === "undefined") return defaultLearn();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.learn);
    if (!raw) {
      // First visit: seed beginner zero → N5 + A1 paths
      return seedBeginnerZeroPaths();
    }
    const parsed = JSON.parse(raw) as LearnState & Record<string, unknown>;
    const needsPathWipe = parsed.pathsEpoch !== LEARN_PATHS_EPOCH;
    if (needsPathWipe) {
      // Wipe then seed beginner JP N5 + EN A1 (user-requested starter paths)
      const wiped = defaultLearn();
      wiped.preferredTrack =
        parsed.preferredTrack === "en" || parsed.preferredTrack === "jp"
          ? parsed.preferredTrack
          : "jp";
      wiped.pathsEpoch = LEARN_PATHS_EPOCH;
      saveLearn(wiped);
      return seedBeginnerZeroPaths({ preferredTrack: wiped.preferredTrack });
    }
    return migrate(parsed);
  } catch {
    return seedBeginnerZeroPaths();
  }
}

/**
 * Fresh beginner paths: JP zero→N5 and EN zero→A1 (full band lessons, no progress).
 */
export function seedBeginnerZeroPaths(opts?: {
  preferredTrack?: TrackId;
}): LearnState {
  const preferred = opts?.preferredTrack === "en" ? "en" : "jp";
  const base = defaultLearn();
  base.preferredTrack = preferred;
  base.pathsEpoch = LEARN_PATHS_EPOCH;
  saveLearn(base);

  savePlacement("jp", "N5", BEGINNER_JP_GOALS);
  addAllBandLessons("jp");
  const afterJp = loadLearn();
  if (afterJp.jp.roadmap) {
    afterJp.jp.roadmap = {
      ...afterJp.jp.roadmap,
      summary: `Lộ trình zero → N5 · ${afterJp.jp.roadmap.weeks.reduce((n, w) => n + (w.days?.length || 0), 0)} bài · chưa học gì.`,
    };
    saveLearn(afterJp);
  }

  savePlacement("en", "A1", BEGINNER_EN_GOALS);
  addAllBandLessons("en");
  const afterEn = loadLearn();
  if (afterEn.en.roadmap) {
    afterEn.en.roadmap = {
      ...afterEn.en.roadmap,
      summary: `Lộ trình zero → A1 · ${afterEn.en.roadmap.weeks.reduce((n, w) => n + (w.days?.length || 0), 0)} bài · chưa học gì.`,
    };
  }
  afterEn.preferredTrack = preferred;
  afterEn.pathsEpoch = LEARN_PATHS_EPOCH;
  // Clear any accidental study counters from seed
  afterEn.reviewsToday = 0;
  afterEn.newCardsToday = 0;
  afterEn.lookupsToday = 0;
  afterEn.activityLog = [];
  afterEn.jp.evidence = emptyEvidence();
  afterEn.en.evidence = emptyEvidence();
  afterEn.jp.actionProgress = {};
  afterEn.en.actionProgress = {};
  afterEn.jp.lessonProgress = {};
  afterEn.en.lessonProgress = {};
  saveLearn(afterEn);
  return afterEn;
}

/** Clear JP + EN then re-seed beginner N5 + A1. Desk untouched. */
export function resetLanguagePaths(): LearnState {
  const prev = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.learn);
      if (!raw) return null;
      return JSON.parse(raw) as LearnState;
    } catch {
      return null;
    }
  })();
  const preferred =
    prev?.preferredTrack === "en" || prev?.preferredTrack === "jp"
      ? prev.preferredTrack
      : "jp";
  return seedBeginnerZeroPaths({ preferredTrack: preferred });
}

export function saveLearn(state: LearnState) {
  localStorage.setItem(STORAGE_KEYS.learn, JSON.stringify(state));
}

export function getTrack(state: LearnState, track: TrackId): TrackState {
  return track === "jp" ? state.jp : state.en;
}

export function setPreferredTrack(track: TrackId) {
  const state = loadLearn();
  state.preferredTrack = track;
  saveLearn(state);
  return state;
}

export function getJpSeed(): VocabSeed[] {
  return [
    ...(jpSeedN5 as VocabSeed[]),
    ...(jpSeedN4 as VocabSeed[]),
    ...(jpSeedN3 as VocabSeed[]),
    ...(jpSeedN2 as VocabSeed[]),
    ...(jpSeedN1 as VocabSeed[]),
  ];
}

export function getEnSeed(): VocabSeed[] {
  return (enSeed as VocabSeed[]).map((w) => {
    const pos = (w.pos || "").trim();
    const raw = w.meanings || [];
    const cleaned = raw.filter(
      (m) =>
        m &&
        m !== w.word &&
        !/^EN ·/i.test(m) &&
        !/^CEFR /i.test(m) &&
        m.toLowerCase() !== pos.toLowerCase(),
    );
    // Keep seed lean; Vietnamese display comes from gloss-vi overlay
    return {
      ...w,
      meanings: cleaned.length ? cleaned : pos ? [pos] : [w.word],
    };
  });
}

export function searchVocab(query: string, track: TrackId = "jp", limit = 8): VocabSeed[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const list = track === "jp" ? getJpSeed() : getEnSeed();
  return list
    .filter((w) => {
      const vi = getVocabGlossVi(track, w.id)?.vi?.toLowerCase() || "";
      return (
        w.word.toLowerCase().includes(q) ||
        (w.reading || "").includes(q) ||
        (w.romaji || "").toLowerCase().includes(q) ||
        w.meanings.some((m) => m.toLowerCase().includes(q)) ||
        vi.includes(q)
      );
    })
    .slice(0, limit);
}

let seedIndexJp: Map<string, VocabSeed> | null = null;
let seedIndexEn: Map<string, VocabSeed> | null = null;

function seedIndex(track: TrackId): Map<string, VocabSeed> {
  if (track === "jp") {
    if (!seedIndexJp) {
      seedIndexJp = new Map(getJpSeed().map((w) => [w.id, w]));
    }
    return seedIndexJp;
  }
  if (!seedIndexEn) {
    seedIndexEn = new Map(getEnSeed().map((w) => [w.id, w]));
  }
  return seedIndexEn;
}

/** Slim persist: sourceId + FSRS only (content from seed on read). */
function cardFromVocab(track: TrackId, w: VocabSeed): SerializedCard {
  return {
    sourceId: w.id,
    track,
    card: serializeCard(newCard(new Date())),
  };
}

export function hydrateCard(c: SerializedCard): HydratedCard {
  const seed = seedIndex(c.track).get(c.sourceId);
  const word = c.word || seed?.word || c.sourceId;
  const reading = c.reading ?? seed?.reading;
  const fallback =
    seed?.meanings?.length
      ? seed.meanings
      : c.meanings?.length
        ? c.meanings
        : ["(manual)"];
  const meanings = displayMeanings(c.track, c.sourceId, fallback, {
    word,
    pos: seed?.pos,
  });
  return {
    ...c,
    word,
    reading,
    meanings,
    exampleJa: c.exampleJa ?? seed?.examples?.[0]?.ja,
    exampleEn: c.exampleEn ?? seed?.examples?.[0]?.en,
  };
}

/** Full primary level into deck (intensity only affects daily new/ETA, not size). */
function seedCards(track: TrackId, band: string, _intensity?: PathIntensity): SerializedCard[] {
  return primaryLevelPool(track, band).map((w) => cardFromVocab(track, w));
}

export const STABLE_INTERVAL_DAYS = 3;

export type LevelMastery = {
  primary: string;
  total: number;
  touched: number;
  stable: number;
  masteryPct: number;
  stablePct: number;
};

export type PathPace = {
  status: "ahead" | "on_track" | "behind";
  elapsedDays: number;
  etaDays: number;
  expectedMastery: number;
  actualMastery: number;
  label: string;
};

/** Append more band vocab into the active SRS deck (skips duplicates). */
export function appendBandVocab(track: TrackId, batch = 40): number {
  const state = normalize(loadLearn());
  const t = getTrack(state, track);
  if (!t.pathActive || !t.band) return 0;
  const intensity = (t.pathGoals?.intensity || "standard") as PathIntensity;
  const have = new Set(t.cards.map((c) => c.sourceId));
  const extra = moreCurriculumVocab(track, t.band, have, intensity, batch);
  if (!extra.length) return 0;
  t.cards = [...t.cards, ...extra.map((w) => cardFromVocab(track, w))];
  saveLearn(state);
  return extra.length;
}

export function getLevelCover(track: TrackId, state = loadLearn()): LevelCover | null {
  const t = getTrack(state, track);
  if (!t.pathActive || !t.band) return null;
  return levelCoverStats(
    track,
    t.band,
    t.cards.map((c) => c.sourceId),
  );
}

export function getLevelMastery(track: TrackId, state = loadLearn()): LevelMastery | null {
  const t = getTrack(normalize(state), track);
  if (!t.pathActive || !t.band) return null;
  const pool = primaryLevelPool(track, t.band);
  const byId = new Map(t.cards.map((c) => [c.sourceId, c]));
  let touched = 0;
  let stable = 0;
  for (const w of pool) {
    const c = byId.get(w.id);
    if (!c) continue;
    const snap = coerceSnapshot(c.card);
    if ((snap.reps ?? 0) > 0) {
      touched += 1;
      if ((snap.scheduled_days ?? 0) >= STABLE_INTERVAL_DAYS) stable += 1;
    }
  }
  const total = pool.length;
  return {
    primary: levelCoverStats(track, t.band, byId.keys()).primary,
    total,
    touched,
    stable,
    masteryPct: total ? Math.round((touched / total) * 100) : 0,
    stablePct: total ? Math.round((stable / total) * 100) : 0,
  };
}

export type TodayPlan = {
  week: RoadmapWeek;
  day: RoadmapDay;
  weekIndex: number;
  elapsedDays: number;
  etaDays: number;
  /** Soft: session already has grades today */
  studiedToday: boolean;
  continueHint: string;
};

function weekVocabIds(week: RoadmapWeek): string[] {
  if (week.days?.length) {
    const ids: string[] = [];
    for (const d of week.days) {
      if (d.vocabSourceIds?.length) ids.push(...d.vocabSourceIds);
    }
    return ids;
  }
  return [];
}

function cardReps(t: TrackState, sourceId: string): number {
  const c = t.cards.find((x) => x.sourceId === sourceId);
  if (!c) return 0;
  return coerceSnapshot(c.card).reps ?? 0;
}

/** Vocab mastery 0..1 for a week's planned ids (aligns % with data chunks). */
export function weekVocabMastery(
  track: TrackId,
  weekNum: number,
  state = loadLearn(),
): { touched: number; total: number; pct: number } {
  const t = getTrack(normalize(state), track);
  const week = t.roadmap?.weeks.find((w) => w.week === weekNum);
  const ids = week ? weekVocabIds(week) : [];
  if (!ids.length) return { touched: 0, total: 0, pct: 0 };
  const touched = ids.filter((id) => cardReps(t, id) > 0).length;
  return {
    touched,
    total: ids.length,
    pct: Math.round((touched / ids.length) * 100),
  };
}

/** Skill actions that must finish before the day unlocks the next (not optional dictionary). */
const DAY_REQUIRED_SKILLS = new Set(["grammar", "kanji", "listening", "mock"]);

function skillLabel(kind: string, track: TrackId): string {
  if (kind === "grammar") return "ngữ pháp";
  if (kind === "kanji") return track === "jp" ? "kanji" : "từ";
  if (kind === "listening") return "nghe";
  if (kind === "mock") return "mock";
  return kind;
}

function dayRequiredSkills(day: RoadmapDay) {
  return (day.actions || []).filter((a) => DAY_REQUIRED_SKILLS.has(a.kind));
}

function cardLastGrade(t: TrackState, sourceId: string): number | undefined {
  return t.cards.find((x) => x.sourceId === sourceId)?.lastGrade;
}

/** Card still needs work in this lesson: never rated, or last grade below Good. */
export function cardNeedsLessonPass(t: TrackState, sourceId: string): boolean {
  const c = t.cards.find((x) => x.sourceId === sourceId);
  if (!c) return true;
  const reps = coerceSnapshot(c.card).reps ?? 0;
  if (reps <= 0) return true;
  const g = c.lastGrade;
  if (g == null) return true;
  return g < Rating.Good;
}

/**
 * Vocab part of a day: every card rated, and ≥ LESSON_PASS_GOOD_RATIO are Good/Easy.
 * Again/Hard keep the card in queue until quality is met — cannot skip-pass.
 */
function dayVocabDone(_track: TrackId, day: RoadmapDay, t: TrackState): boolean {
  const ids = day.vocabSourceIds || [];
  if (!ids.length) return true;
  if (ids.some((id) => cardNeedsLessonPass(t, id))) return false;
  const good = ids.filter((id) => (cardLastGrade(t, id) ?? 0) >= Rating.Good).length;
  return good / ids.length >= LESSON_PASS_GOOD_RATIO;
}

function isSkillActionDone(day: RoadmapDay, action: { id: string; kind: string }, t: TrackState): boolean {
  if (t.actionProgress[action.id]?.doneAt) return true;
  if (
    day.lessonId &&
    day.lessonKind === action.kind &&
    t.lessonProgress?.[day.lessonId]?.doneAt
  ) {
    return true;
  }
  return false;
}

function daySkillsDone(_track: TrackId, day: RoadmapDay, t: TrackState): boolean {
  const skills = dayRequiredSkills(day);
  if (!skills.length) {
    // Lesson-only non-vocab day (no skill actions listed): need lessonProgress
    if (day.lessonId && day.lessonKind && day.lessonKind !== "vocab") {
      return Boolean(t.lessonProgress?.[day.lessonId]?.doneAt);
    }
    return true;
  }
  return skills.every((a) => isSkillActionDone(day, a, t));
}

function pendingSkillLabels(day: RoadmapDay, track: TrackId, t: TrackState): string[] {
  return dayRequiredSkills(day)
    .filter((a) => !isSkillActionDone(day, a, t))
    .map((a) => skillLabel(a.kind, track));
}

/** Resolve “hôm nay học gì” — first day not fully complete (vocab + required skills). */
export function getTodayPlan(track: TrackId, state = loadLearn()): TodayPlan | null {
  const s = normalize(state);
  const t = getTrack(s, track);
  if (!t.pathActive || !t.roadmap?.weeks?.length) return null;
  const started =
    t.pathStartedAt || t.roadmap.startedAt || t.roadmap.generatedAt || new Date().toISOString();
  const elapsedDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(started).getTime()) / 86400000),
  );
  const etaDays = t.roadmap.etaDays || Math.max(7, t.roadmap.weeks.length * 7);
  const weeks = t.roadmap.weeks;
  const wi = pathWeekIndex(track, s);
  const week = weeks[Math.min(wi, weeks.length - 1)];
  const days = week.days || [];
  const openDay = days.findIndex((d) => !isDayComplete(track, d, s));
  const dayIdx = openDay >= 0 ? openDay : Math.max(0, days.length - 1);
  const day = days[dayIdx];
  if (!day) return null;
  const studiedToday =
    (s.reviewsToday || 0) > 0 ||
    (s.activityLog.find((d) => d.day === todayKey())?.minutes || 0) > 0;
  const vocabOk = dayVocabDone(track, day, t);
  const pending = pendingSkillLabels(day, track, t);

  let continueHint: string;
  if (vocabOk && pending.length) {
    continueHint = `Từ vựng bài này xong — còn làm ${pending.join(", ")} trước khi sang bài tiếp.`;
  } else if (!vocabOk) {
    continueHint = `Bài hiện tại: ${day.newVocabTarget || day.vocabSourceIds?.length || "?"} từ. Xong từ + skill trong bài mới mở bài kế.`;
  } else if (studiedToday) {
    continueHint = "Đang học — xong đủ phần của bài này mới sang bài tiếp.";
  } else {
    continueHint = `Bài ${day.day}: hoàn thành toàn bộ phần trong bài rồi mới mở bài sau.`;
  }

  return {
    week,
    day,
    weekIndex: wi,
    elapsedDays,
    etaDays,
    studiedToday,
    continueHint,
  };
}

export function getPathPace(track: TrackId, state = loadLearn()): PathPace | null {
  const s = normalize(state);
  const t = getTrack(s, track);
  if (!t.pathActive || !t.band) return null;
  const mastery = getLevelMastery(track, s);
  if (!mastery) return null;
  const intensity = (t.pathGoals?.intensity || "standard") as PathIntensity;
  const schedule =
    t.roadmap?.etaDays && t.roadmap.poolSize
      ? {
          etaDays: t.roadmap.etaDays,
          poolSize: t.roadmap.poolSize,
          newPerDay: t.roadmap.newPerDay || newCardsPerDay(intensity),
          etaWeeks: t.roadmap.etaWeeks || Math.ceil(t.roadmap.etaDays / 7),
        }
      : estimatePathSchedule(mastery.total, intensity);
  const started =
    t.pathStartedAt || t.roadmap?.startedAt || t.roadmap?.generatedAt || new Date().toISOString();
  const elapsedDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(started).getTime()) / 86400000),
  );
  const expectedMastery = Math.min(
    100,
    Math.round((elapsedDays / Math.max(1, schedule.etaDays)) * 100),
  );
  const actualMastery = mastery.masteryPct;
  let status: PathPace["status"] = "on_track";
  if (actualMastery >= expectedMastery + 10) status = "ahead";
  else if (actualMastery <= expectedMastery - 10) status = "behind";
  const label =
    status === "ahead" ? "Sớm hơn ETA" : status === "behind" ? "Chậm hơn ETA" : "Đúng nhịp ETA";
  return {
    status,
    elapsedDays,
    etaDays: schedule.etaDays,
    expectedMastery,
    actualMastery,
    label,
  };
}

/**
 * Backfill remaining primary ids (legacy decks). No-op when cover already 100%.
 */
export function appendFullPrimaryVocab(
  track: TrackId,
  opts?: { confirmLarge?: boolean; previewOnly?: boolean },
): { added: number; missing: number; wouldExceed: boolean; nextSize: number } {
  const state = normalize(loadLearn());
  const t = getTrack(state, track);
  if (!t.pathActive || !t.band) {
    return { added: 0, missing: 0, wouldExceed: false, nextSize: t.cards.length };
  }
  const have = new Set(t.cards.map((c) => c.sourceId));
  const missingList = remainingPrimaryVocab(track, t.band, have);
  const nextSize = t.cards.length + missingList.length;
  const wouldExceed = false;
  if (opts?.previewOnly) {
    return { added: 0, missing: missingList.length, wouldExceed, nextSize };
  }
  if (!missingList.length) {
    return { added: 0, missing: 0, wouldExceed: false, nextSize: t.cards.length };
  }
  t.cards = [...t.cards, ...missingList.map((w) => cardFromVocab(track, w))];
  saveLearn(state);
  return { added: missingList.length, missing: 0, wouldExceed, nextSize: t.cards.length };
}

export const PROMOTE_MASTERY_MIN = 85;
export const PROMOTE_STABLE_MIN = 50;
export const PROMOTE_MOCK_MIN = 60;
/** @deprecated use PROMOTE_MASTERY_MIN — kept for smoke/compat */
export const PROMOTE_OVERALL_MIN = PROMOTE_MASTERY_MIN;

export function nextBandFor(track: TrackId, band: string): string | null {
  const next = shiftBand(track, band, 1);
  return next === band ? null : next;
}

export function canPromoteBand(
  track: TrackId,
  state = loadLearn(),
): { ok: boolean; next: string | null; reason: string } {
  const t = getTrack(state, track);
  if (!t.pathActive || !t.band) {
    return { ok: false, next: null, reason: "Chưa có path đang học." };
  }
  const next = nextBandFor(track, t.band);
  if (!next) {
    return { ok: false, next: null, reason: `Đã ở band cao nhất (${t.band}).` };
  }
  const mastery = getLevelMastery(track, state);
  const ev = t.evidence;
  const mockOk =
    (ev?.mockBest?.vocab ?? 0) >= PROMOTE_MOCK_MIN ||
    (ev?.mockBest?.listening ?? 0) >= PROMOTE_MOCK_MIN;
  const mPct = mastery?.masteryPct ?? 0;
  const sPct = mastery?.stablePct ?? 0;
  if (mPct < PROMOTE_MASTERY_MIN || sPct < PROMOTE_STABLE_MIN || !mockOk) {
    return {
      ok: false,
      next,
      reason: `Cần mastery ≥${PROMOTE_MASTERY_MIN}%, stable ≥${PROMOTE_STABLE_MIN}%, mock ≥${PROMOTE_MOCK_MIN}%. Hiện mastery ${mPct}% · stable ${sPct}%.`,
    };
  }
  return { ok: true, next, reason: `Sẵn sàng lên ${next}.` };
}

/** Promote to next band: keep old cards, seed full primary of next band (slim). */
export function promoteBand(track: TrackId): { ok: boolean; from: string; to: string | null; added: number; message: string } {
  const state = normalize(loadLearn());
  const gate = canPromoteBand(track, state);
  const t = getTrack(state, track);
  const from = t.band || "";
  if (!gate.ok || !gate.next) {
    return { ok: false, from, to: gate.next, added: 0, message: gate.reason };
  }
  const goals = normalizePathGoals(t.pathGoals || DEFAULT_PATH_GOALS);
  const to = gate.next;
  const have = new Set(t.cards.map((c) => c.sourceId));
  const fresh = primaryLevelPool(track, to).filter((w) => !have.has(w.id));
  const startedAt = new Date().toISOString();
  t.band = to;
  t.pathStartedAt = startedAt;
  t.roadmap = buildRoadmap(track, to, goals, { startedAt });
  t.pathGoals = goals;
  t.actionProgress = {};
  t.evidence = emptyEvidence();
  if (fresh.length) {
    t.cards = [...t.cards, ...fresh.map((w) => cardFromVocab(track, w))];
  }
  saveLearn(state);
  return {
    ok: true,
    from,
    to,
    added: fresh.length,
    message: `Đã nâng ${from} → ${to} (+${fresh.length} thẻ primary slim).`,
  };
}

export type { LevelCover };

/**
 * After placement: save band + goals only.
 * Does NOT seed deck or build roadmap — user adds lessons gradually.
 */
export function savePlacement(
  track: TrackId,
  band: string,
  goalsInput?: PathGoals | null,
) {
  const state = normalize(loadLearn());
  const t = track === "jp" ? state.jp : state.en;
  const goals = normalizePathGoals(goalsInput || t.pathGoals || DEFAULT_PATH_GOALS);
  const bandChanged = t.band !== band;
  t.band = band;
  t.placementDone = true;
  t.pathGoals = goals;
  // Keep existing path if same band; otherwise clear for fresh build later
  if (bandChanged) {
    t.pathActive = false;
    t.roadmap = null;
    t.cards = [];
    t.actionProgress = {};
    t.evidence = emptyEvidence();
    t.pathStartedAt = null;
  }
  state.preferredTrack = track;
  saveLearn(state);
  return state;
}

export type PathExtendMode = "lesson" | "chapter" | "full" | "suggest";

export type PathBuildStats = {
  band: string;
  poolSize: number;
  inPath: number;
  remainingWords: number;
  remainingLessons: number;
  pathLessonCount: number;
  wordsPerLesson: number;
  lessons: Lesson[];
};

function pathLessonIds(t: TrackState): Set<string> {
  const ids = new Set<string>();
  for (const w of t.roadmap?.weeks || []) {
    for (const d of w.days || []) {
      if (d.lessonId) ids.add(d.lessonId);
    }
  }
  return ids;
}

/** How much of the level library is still available to add. */
export function pathBuildStats(track: TrackId, state = loadLearn()): PathBuildStats | null {
  const t = getTrack(normalize(state), track);
  if (!t.placementDone || !t.band) return null;
  const intensity = (t.pathGoals?.intensity || "standard") as PathIntensity;
  const wordsPerLesson = newCardsPerDay(intensity);
  const lessons = listLessons({ track, band: t.band });
  const inPath = pathLessonIds(t);
  const have = new Set(t.cards.map((c) => c.sourceId));
  const pool = primaryLevelPool(track, t.band);
  const remainingWords = pool.filter((w) => !have.has(w.id)).length;
  const remainingLessons = lessons.filter((l) => !inPath.has(l.id)).length;
  return {
    band: t.band,
    poolSize: pool.length,
    inPath: inPath.size,
    remainingWords,
    remainingLessons,
    pathLessonCount: inPath.size,
    wordsPerLesson,
    lessons,
  };
}

function seedVocabFromLessons(track: TrackId, lessons: Lesson[], have: Set<string>): SerializedCard[] {
  const idx = seedIndex(track);
  const out: SerializedCard[] = [];
  for (const lesson of lessons) {
    for (const id of lessonVocabIds(lesson)) {
      if (have.has(id)) continue;
      const w = idx.get(id);
      if (!w) continue;
      have.add(id);
      out.push(cardFromVocab(track, w));
    }
  }
  return out;
}

export type AddLessonsResult = {
  ok: boolean;
  addedCards: number;
  addedLessons: number;
  message: string;
};

/** Append specific lessons to the path (1 day each) and seed vocab SRS. */
export function addLessonsToPath(track: TrackId, lessonIds: string[]): AddLessonsResult {
  const state = normalize(loadLearn());
  if (!freemiumUnlocked() && !isProUser()) {
    if (track === "jp") state.en.pathActive = false;
    else state.jp.pathActive = false;
  }
  const t = getTrack(state, track);
  if (!t.placementDone || !t.band) {
    return { ok: false, addedCards: 0, addedLessons: 0, message: "Hãy làm placement trước." };
  }
  const goals = normalizePathGoals(t.pathGoals || DEFAULT_PATH_GOALS);
  const already = pathLessonIds(t);
  const lessons: Lesson[] = [];
  for (const id of lessonIds) {
    const lesson = getLesson(id);
    if (!lesson || lesson.track !== track) continue;
    if (lesson.band !== t.band) continue;
    if (already.has(lesson.id)) continue;
    lessons.push(lesson);
  }
  if (!lessons.length) {
    return {
      ok: false,
      addedCards: 0,
      addedLessons: 0,
      message: "Không có bài mới để thêm (đã có trong path hoặc sai band).",
    };
  }

  const have = new Set(t.cards.map((c) => c.sourceId));
  const newCards = seedVocabFromLessons(track, lessons, have);
  t.cards = [...t.cards, ...newCards];

  const startedAt = t.pathStartedAt || new Date().toISOString();
  t.pathStartedAt = startedAt;
  t.pathActive = true;
  t.pathGoals = goals;

  const absStart =
    1 + (t.roadmap?.weeks || []).reduce((n, w) => n + (w.days?.length || 0), 0);
  const weekStart = (t.roadmap?.weeks.length || 0) + 1;
  const newWeeks = buildWeeksFromLessons(track, t.band, lessons, weekStart, absStart);
  const pool = primaryLevelPool(track, t.band);
  const schedule = estimatePathSchedule(pool.length, goals.intensity);
  const vocabIds = lessons.flatMap((l) => lessonVocabIds(l));

  if (!t.roadmap || t.roadmap.band !== t.band) {
    t.roadmap = {
      track,
      band: t.band,
      generatedAt: new Date().toISOString(),
      startedAt,
      summary: `Lộ trình ${t.band} · ${lessons.length} bài từ thư viện.`,
      inventory: {
        vocab: t.cards.length,
        kanji: lessons.filter((l) => l.kind === "kanji").length,
        grammar: lessons.filter((l) => l.kind === "grammar").length,
        mocks: lessons.filter((l) => l.kind === "mock" || l.kind === "listening").length,
      },
      weeks: newWeeks,
      vocabSourceIds: vocabIds,
      poolSize: pool.length,
      newPerDay: schedule.newPerDay,
      etaDays: schedule.etaDays,
      etaWeeks: schedule.etaWeeks,
      planVersion: ROADMAP_PLAN_VERSION,
    };
  } else {
    const mergedWeeks = [...t.roadmap.weeks, ...newWeeks];
    t.roadmap = {
      ...t.roadmap,
      weeks: mergedWeeks,
      vocabSourceIds: [...new Set([...t.roadmap.vocabSourceIds, ...vocabIds])],
      inventory: {
        ...t.roadmap.inventory,
        vocab: t.cards.length,
      },
      summary: `Lộ trình ${t.band} · ${pathLessonIds({ ...t, roadmap: { ...t.roadmap, weeks: mergedWeeks } }).size} bài đã thêm.`,
      planVersion: ROADMAP_PLAN_VERSION,
    };
  }
  if (!t.evidence) t.evidence = emptyEvidence();
  if (!t.lessonProgress) t.lessonProgress = {};
  state.preferredTrack = track;
  saveLearn(state);
  return {
    ok: true,
    addedCards: newCards.length,
    addedLessons: lessons.length,
    message: `Đã thêm ${lessons.length} bài vào lộ trình` + (newCards.length ? ` (+${newCards.length} từ SRS).` : "."),
  };
}

export function addSuggestedPath(track: TrackId): AddLessonsResult {
  const t = getTrack(normalize(loadLearn()), track);
  if (!t.placementDone || !t.band) {
    return { ok: false, addedCards: 0, addedLessons: 0, message: "Hãy làm placement trước." };
  }
  const suggested = suggestLessons(track, t.band, t.pathGoals);
  const already = pathLessonIds(t);
  const ids = suggested.filter((l) => !already.has(l.id)).map((l) => l.id);
  if (!ids.length) {
    return { ok: false, addedCards: 0, addedLessons: 0, message: "Gợi ý đã có trong path." };
  }
  return addLessonsToPath(track, ids);
}

export function addAllBandLessons(track: TrackId): AddLessonsResult {
  const t = getTrack(normalize(loadLearn()), track);
  if (!t.placementDone || !t.band) {
    return { ok: false, addedCards: 0, addedLessons: 0, message: "Hãy làm placement trước." };
  }
  const already = pathLessonIds(t);
  const ids = listLessons({ track, band: t.band })
    .filter((l) => !already.has(l.id))
    .map((l) => l.id);
  if (!ids.length) {
    return { ok: false, addedCards: 0, addedLessons: 0, message: "Đã thêm hết bài của cấp này." };
  }
  return addLessonsToPath(track, ids);
}

/** Compat: lesson=1 suggested vocab-first, chapter≈7, full=all, suggest=goals mix. */
export function extendPath(track: TrackId, mode: PathExtendMode): AddLessonsResult {
  const t = getTrack(normalize(loadLearn()), track);
  if (!t.placementDone || !t.band) {
    return { ok: false, addedCards: 0, addedLessons: 0, message: "Hãy làm placement trước." };
  }
  if (mode === "full") return addAllBandLessons(track);
  if (mode === "suggest") return addSuggestedPath(track);
  const already = pathLessonIds(t);
  const pool = listLessons({ track, band: t.band, kind: "vocab" }).filter(
    (l) => !already.has(l.id),
  );
  const take = mode === "lesson" ? 1 : 7;
  return addLessonsToPath(
    track,
    pool.slice(0, take).map((l) => l.id),
  );
}

export function markLessonDone(track: TrackId, lessonId: string) {
  const state = normalize(loadLearn());
  const t = getTrack(state, track);
  if (!t.lessonProgress) t.lessonProgress = {};
  t.lessonProgress[lessonId] = { doneAt: new Date().toISOString() };
  // Also tick matching day actions
  for (const w of t.roadmap?.weeks || []) {
    for (const d of w.days || []) {
      if (d.lessonId !== lessonId) continue;
      for (const a of d.actions) {
        if (!t.actionProgress[a.id]?.doneAt) {
          t.actionProgress[a.id] = { doneAt: new Date().toISOString() };
        }
      }
    }
  }
  saveLearn(state);
  return syncPathFromActivity(track, state);
}

export function isLessonDone(track: TrackId, lessonId: string, state = loadLearn()): boolean {
  const t = getTrack(normalize(state), track);
  if (t.lessonProgress?.[lessonId]?.doneAt) return true;
  const lesson = getLesson(lessonId);
  if (!lesson) return false;
  if (lesson.kind === "vocab") {
    const ids = lessonVocabIds(lesson);
    if (!ids.length) return false;
    if (ids.some((id) => cardNeedsLessonPass(t, id))) return false;
    const good = ids.filter((id) => (cardLastGrade(t, id) ?? 0) >= Rating.Good).length;
    return good / ids.length >= LESSON_PASS_GOOD_RATIO;
  }
  return false;
}

export function isLessonInPath(track: TrackId, lessonId: string, state = loadLearn()): boolean {
  return pathLessonIds(getTrack(normalize(state), track)).has(lessonId);
}

/** Ensure vocab cards for a lesson exist (study from menu without path). */
export function ensureLessonCards(track: TrackId, lessonId: string): number {
  const lesson = getLesson(lessonId);
  if (!lesson || lesson.track !== track) return 0;
  const state = normalize(loadLearn());
  const t = getTrack(state, track);
  const have = new Set(t.cards.map((c) => c.sourceId));
  const added = seedVocabFromLessons(track, [lesson], have);
  if (!added.length) return 0;
  t.cards = [...t.cards, ...added];
  // Allow review without full path
  if (!t.pathActive && t.placementDone) {
    /* keep pathActive false — menu study */
  }
  saveLearn(state);
  return added.length;
}

/** Full-level activate (optional). Prefer addLessonsToPath / addSuggestedPath. */
export function activatePath(
  track: TrackId,
  band: string,
  goalsInput?: PathGoals | null,
) {
  const state = normalize(loadLearn());
  if (!freemiumUnlocked() && !isProUser()) {
    state.jp.pathActive = false;
    state.en.pathActive = false;
  }
  const t = track === "jp" ? state.jp : state.en;
  const sameBand = t.band === band && t.pathActive;
  const goals = normalizePathGoals(goalsInput || t.pathGoals || DEFAULT_PATH_GOALS);
  const bandChanged = t.band !== band;
  const startedAt =
    sameBand && t.pathStartedAt ? t.pathStartedAt : new Date().toISOString();
  const plan = buildRoadmap(track, band, goals, { startedAt });
  t.band = band;
  t.placementDone = true;
  t.pathActive = true;
  t.roadmap = plan;
  t.pathGoals = goals;
  t.pathStartedAt = startedAt;
  if (bandChanged || !t.cards.length) {
    t.cards = seedCards(track, band, goals.intensity);
    t.actionProgress = {};
    t.evidence = emptyEvidence();
  } else if (!sameBand) {
    t.actionProgress = {};
    t.evidence = emptyEvidence();
  } else {
    const have = new Set(t.cards.map((c) => c.sourceId));
    const missing = remainingPrimaryVocab(track, band, have);
    if (missing.length) {
      t.cards = [...t.cards, ...missing.map((w) => cardFromVocab(track, w))];
    }
  }
  if (!t.cards.length) t.cards = seedCards(track, band, goals.intensity);
  if (!t.evidence) t.evidence = emptyEvidence();
  state.preferredTrack = track;
  saveLearn(state);
  return state;
}

/** Fix legacy EN days that were labeled “kanji” (JP-only focus). */
function sanitizeTrackRoadmapLabels(track: TrackId, t: TrackState): boolean {
  if (!t.roadmap?.weeks?.length) return false;
  let changed = false;
  const weeks = t.roadmap.weeks.map((w) => {
    if (!w.days?.length) return w;
    const days = w.days.map((d) => {
      if (track === "en" && (d.focus === "kanji" || /\bkanji\b/i.test(d.title || ""))) {
        changed = true;
        return {
          ...d,
          focus: "grammar" as const,
          title: (d.title || "")
            .replace(/\bkanji\b/gi, "ngữ pháp")
            .replace(/Kanji\s*\+\s*từ/gi, "Ngữ pháp + từ"),
          actions: d.actions.map((a) =>
            a.kind === "kanji"
              ? {
                  ...a,
                  kind: "grammar" as const,
                  title: a.title.replace(/kanji/gi, "ngữ pháp"),
                  href: `/learn/grammar?track=en&level=${t.band || "A1"}`,
                }
              : a,
          ),
        };
      }
      return d;
    });
    return days === w.days ? w : { ...w, days };
  });
  if (changed) {
    t.roadmap = { ...t.roadmap, weeks, planVersion: ROADMAP_PLAN_VERSION };
  }
  return changed;
}

/**
 * Migrate active paths only. Placement-without-path stays empty until user adds lessons.
 */
export function ensureRoadmap(track: TrackId) {
  let state = normalize(loadLearn());
  const t = getTrack(state, track);
  if (!t.placementDone || !t.band) return state;
  // Do not auto-build full path after placement alone
  if (!t.pathActive || !t.roadmap?.weeks?.length) return state;

  const sanitized = sanitizeTrackRoadmapLabels(track, t);
  if (sanitized) saveLearn(state);

  const needsPlan =
    t.roadmap.band !== t.band ||
    t.roadmap.poolSize == null ||
    t.roadmap.planVersion !== ROADMAP_PLAN_VERSION;
  if (needsPlan && t.roadmap.weeks.length) {
    // Keep incremental weeks; only bump metadata / rebuild if empty days
    const hasDays = t.roadmap.weeks.some((w) => (w.days?.length || 0) > 0);
    if (!hasDays) {
      const startedAt = t.pathStartedAt || t.roadmap.startedAt || new Date().toISOString();
      t.pathStartedAt = startedAt;
      t.roadmap = buildRoadmap(track, t.band, t.pathGoals, { startedAt });
      saveLearn(state);
    } else {
      t.roadmap = { ...t.roadmap, planVersion: ROADMAP_PLAN_VERSION };
      saveLearn(state);
    }
  }
  state = syncPathFromActivity(track, loadLearn());
  return state;
}

/** Legacy: % SRS cards touched at least once. */
export function pathProgress(track: TrackId, state = loadLearn()) {
  const t = getTrack(state, track);
  if (!t.pathActive || !t.cards.length) return 0;
  const touched = t.cards.filter((c) => (c.card?.reps ?? 0) > 0).length;
  return Math.round((touched / t.cards.length) * 100);
}

/**
 * 0..1 credit from real evidence (or persisted tick).
 * Opening a page / sitting idle does NOT increase this.
 */
export function actionCredit(
  t: TrackState,
  action: { id: string; kind: string },
  _reviewsToday = 0,
): number {
  if (t.actionProgress[action.id]?.doneAt) return 1;
  return evidenceCreditForKind(action.kind, normalizeEvidence(t.evidence));
}

export function isActionComplete(
  t: TrackState,
  action: { id: string; kind: string },
  reviewsToday = 0,
): boolean {
  return actionCredit(t, action, reviewsToday) >= 1;
}

/** Raw week % from that week's vocab ids only (no global evidence bleed). */
function weekProgressRaw(
  track: TrackId,
  weekNum: number,
  state: LearnState,
): number {
  const t = getTrack(normalize(state), track);
  const week = t.roadmap?.weeks.find((w) => w.week === weekNum);
  if (!week) return 0;

  const vm = weekVocabMastery(track, weekNum, state);
  if (vm.total > 0) return vm.pct;

  // Checkpoint week (nghe/mock): only count when prior study weeks are mostly done
  if (!week.actions.length) return 0;
  const sum = week.actions.reduce((acc, a) => {
    if (a.kind === "review" || a.kind === "vocab") return acc;
    return acc + actionCredit(t, a);
  }, 0);
  const skills = week.actions.filter((a) => a.kind !== "review" && a.kind !== "vocab");
  if (!skills.length) return 0;
  return Math.round((sum / skills.length) * 100);
}

/**
 * Week % = mastery of THAT week's vocab chunk only.
 * Future weeks stay 0 until the previous week reaches ≥80%.
 */
export function weekProgress(
  track: TrackId,
  weekNum: number,
  state = loadLearn(),
): number {
  const s = normalize(state);
  const weeks = getTrack(s, track).roadmap?.weeks || [];
  const idx = weeks.findIndex((w) => w.week === weekNum);
  if (idx < 0) return 0;

  // Lock future weeks: any earlier week < 80% → this week shows 0
  for (let i = 0; i < idx; i++) {
    if (weekProgressRaw(track, weeks[i].week, s) < 80) return 0;
  }
  return weekProgressRaw(track, weekNum, s);
}

export function pathWeekIndex(track: TrackId, state = loadLearn()): number {
  const weeks = getTrack(normalize(state), track).roadmap?.weeks || [];
  if (!weeks.length) return 0;
  for (let i = 0; i < weeks.length; i++) {
    if (weekProgressRaw(track, weeks[i].week, state) < 80) return i;
  }
  return weeks.length - 1;
}

/**
 * Day done only when vocab (if any) AND required skills (grammar/kanji/listening/mock) are done.
 * Dictionary “bổ trợ” is optional and does not block the next day.
 */
export function isDayComplete(
  track: TrackId,
  day: RoadmapDay,
  state = loadLearn(),
): boolean {
  const t = getTrack(normalize(state), track);
  if (day.lessonId && t.lessonProgress?.[day.lessonId]?.doneAt) {
    // Explicit lesson completion still requires vocab cards if this day has them
    if (!dayVocabDone(track, day, t)) return false;
    return daySkillsDone(track, day, t);
  }
  return dayVocabDone(track, day, t) && daySkillsDone(track, day, t);
}

export function dayVocabProgress(
  track: TrackId,
  day: RoadmapDay,
  state = loadLearn(),
): {
  touched: number;
  total: number;
  pct: number;
  done: boolean;
  skillsPending: string[];
  goodCount: number;
  needsQuality: boolean;
} {
  const t = getTrack(normalize(state), track);
  const ids = day.vocabSourceIds || [];
  const skillsPending = pendingSkillLabels(day, track, t);
  const fullDone = isDayComplete(track, day, state);

  if (ids.length) {
    const touched = ids.filter((id) => cardReps(t, id) > 0).length;
    const goodCount = ids.filter((id) => (cardLastGrade(t, id) ?? 0) >= Rating.Good).length;
    const total = ids.length;
    const pct = Math.round((touched / total) * 100);
    const needsQuality =
      touched >= total && goodCount / total < LESSON_PASS_GOOD_RATIO;
    return { touched, total, pct, done: fullDone, skillsPending, goodCount, needsQuality };
  }

  if (fullDone) {
    const total = Math.max(1, day.actions[0]?.count || 1);
    return {
      touched: total,
      total,
      pct: 100,
      done: true,
      skillsPending: [],
      goodCount: total,
      needsQuality: false,
    };
  }
  return {
    touched: 0,
    total: 1,
    pct: 0,
    done: false,
    skillsPending,
    goodCount: 0,
    needsQuality: false,
  };
}

/** Overall path % = share of deck cards already opened (true level progress). */
export function pathOverallProgress(track: TrackId, state = loadLearn()): number {
  return pathProgress(track, state);
}

/** Persist ✓ when week vocab mastery high enough or skill evidence complete. */
export function syncPathFromActivity(track: TrackId, state = loadLearn()): LearnState {
  let next = normalize(state);
  const t = getTrack(next, track);
  if (!t.roadmap?.weeks.length) return next;
  const progress = { ...t.actionProgress };
  const lessonProg = { ...(t.lessonProgress || {}) };
  let added = 0;
  for (const w of t.roadmap.weeks) {
    const vm = weekVocabMastery(track, w.week, next);
    for (const a of w.actions) {
      if (progress[a.id]?.doneAt) continue;
      const probe = { ...t, actionProgress: progress };
      let done = false;
      if (a.kind === "review" || a.kind === "vocab") {
        done = vm.total > 0 ? vm.pct >= 80 : actionCredit(probe, a) >= 1;
      } else {
        done = actionCredit(probe, a) >= 1;
      }
      if (done) {
        progress[a.id] = { doneAt: new Date().toISOString() };
        added += 1;
      }
    }
    for (const d of w.days || []) {
      if (!d.lessonId || lessonProg[d.lessonId]?.doneAt) continue;
      const probe = { ...t, actionProgress: progress, lessonProgress: lessonProg };
      // Only auto-complete vocab-only lessons when all cards touched — never skip skills
      if (!dayVocabDone(track, d, probe)) continue;
      if (!daySkillsDone(track, d, probe)) continue;
      if (d.lessonKind && d.lessonKind !== "vocab" && dayRequiredSkills(d).length === 0) {
        // Non-vocab lesson without skill actions still needs explicit markLessonDone
        continue;
      }
      if (d.lessonKind === "vocab" || !d.lessonKind) {
        lessonProg[d.lessonId] = { doneAt: new Date().toISOString() };
        added += 1;
        for (const a of d.actions) {
          if (!progress[a.id]?.doneAt) {
            progress[a.id] = { doneAt: new Date().toISOString() };
            added += 1;
          }
        }
      }
    }
  }
  if (!added) return next;
  t.actionProgress = progress;
  t.lessonProgress = lessonProg;
  next = bumpActivity(next, { actions: added });
  getTrack(next, track).actionProgress = progress;
  getTrack(next, track).lessonProgress = lessonProg;
  saveLearn(next);
  return next;
}

export function getPathAdvice(track: TrackId, state = loadLearn()): PathAdvice {
  const s = normalize(state);
  const t = getTrack(s, track);
  const weeks = t.roadmap?.weeks || [];
  const idx = pathWeekIndex(track, s);
  const mastery = getLevelMastery(track, s);
  return buildPathAdvice({
    track,
    band: t.band,
    overall: pathOverallProgress(track, s),
    weekPct: weeks[idx] ? weekProgress(track, weeks[idx].week, s) : 0,
    weekIndex: idx,
    weekCount: weeks.length || 1,
    ev: normalizeEvidence(t.evidence),
    masteryPct: mastery?.masteryPct,
    stablePct: mastery?.stablePct,
  });
}

/** Record a real SRS grade (required for review progress). */
export function recordReviewEvidence(track: TrackId, sourceId: string, grade: Grade) {
  const state = normalize(loadLearn());
  const t = getTrack(state, track);
  const ev = normalizeEvidence(t.evidence);
  if (!ev.reviewIds.includes(sourceId)) ev.reviewIds.push(sourceId);
  const gk = gradeKey(Number(grade));
  if (gk) ev.grades[gk] += 1;
  t.evidence = ev;
  saveLearn(state);
  return syncPathFromActivity(track, state);
}

/** Dictionary: only counts when query returns hits. */
export function recordLookupEvidence(track: TrackId, query: string, hitCount: number) {
  const key = query.trim().toLowerCase();
  if (!key || hitCount <= 0) return loadLearn();
  const state = normalize(loadLearn());
  const t = getTrack(state, track);
  const ev = normalizeEvidence(t.evidence);
  if (!ev.lookupKeys.includes(key)) ev.lookupKeys.push(key);
  t.evidence = ev;
  saveLearn(state);
  return syncPathFromActivity(track, state);
}

export function recordKanjiEvidence(track: TrackId, character: string, known: boolean) {
  if (!known || !character) return loadLearn();
  const state = normalize(loadLearn());
  const t = getTrack(state, track);
  const ev = normalizeEvidence(t.evidence);
  if (!ev.kanjiKnown.includes(character)) ev.kanjiKnown.push(character);
  t.evidence = ev;
  saveLearn(state);
  if (ev.kanjiKnown.length >= EVIDENCE.kanjiKnown) {
    markCurrentDaySkill(track, ["kanji"]);
  }
  return syncPathFromActivity(track, loadLearn());
}

export function recordGrammarEvidence(track: TrackId, itemId: string, correct: boolean) {
  if (!correct || !itemId) return loadLearn();
  const state = normalize(loadLearn());
  const t = getTrack(state, track);
  const ev = normalizeEvidence(t.evidence);
  if (!ev.grammarCorrectIds.includes(itemId)) ev.grammarCorrectIds.push(itemId);
  t.evidence = ev;
  saveLearn(state);
  // Only tick day grammar after a solid streak of corrects (not a free pass)
  if (ev.grammarCorrectIds.length >= EVIDENCE.grammarCorrect) {
    markCurrentDaySkill(track, ["grammar"]);
  }
  return syncPathFromActivity(track, loadLearn());
}

export function recordMockEvidence(
  track: TrackId,
  mode: "vocab" | "listening",
  scorePct: number,
) {
  const state = normalize(loadLearn());
  const t = getTrack(state, track);
  const ev = normalizeEvidence(t.evidence);
  if (mode === "vocab") ev.mockBest.vocab = Math.max(ev.mockBest.vocab, scorePct);
  else ev.mockBest.listening = Math.max(ev.mockBest.listening, scorePct);
  t.evidence = ev;
  saveLearn(state);
  if (scorePct >= EVIDENCE.mockMinScore) {
    markCurrentDaySkill(track, mode === "listening" ? ["listening"] : ["mock"]);
  }
  return syncPathFromActivity(track, loadLearn());
}

export function markActionDone(
  track: TrackId,
  actionId: string,
  score?: number,
) {
  const state = normalize(loadLearn());
  const t = getTrack(state, track);
  if (!t.actionProgress[actionId]) {
    const next = bumpActivity(state, { actions: 1 });
    const tt = getTrack(next, track);
    tt.actionProgress = {
      ...tt.actionProgress,
      [actionId]: {
        doneAt: new Date().toISOString(),
        score,
      },
    };
    saveLearn(next);
    return next;
  }
  if (typeof score === "number") {
    t.actionProgress = {
      ...t.actionProgress,
      [actionId]: { ...t.actionProgress[actionId], score },
    };
    saveLearn(state);
  }
  return state;
}

/**
 * Mark first unfinished action matching kinds.
 * Prefer current week, then scan the whole roadmap (so doing grammar while
 * "week 1" is active still ticks the grammar action).
 */
export function markCurrentWeekAction(
  track: TrackId,
  kinds: Array<RoadmapPlan["weeks"][0]["actions"][0]["kind"]>,
  score?: number,
): { state: LearnState; actionId: string | null; progress: number } {
  const state = normalize(loadLearn());
  const t = getTrack(state, track);
  const weeks = t.roadmap?.weeks || [];
  if (!weeks.length) {
    return { state, actionId: null, progress: pathOverallProgress(track, state) };
  }
  const idx = pathWeekIndex(track, state);
  const order = [
    weeks[idx],
    ...weeks.filter((_, i) => i !== idx),
  ].filter(Boolean);

  let actionId: string | null = null;
  for (const week of order) {
    const action = week.actions.find(
      (a) => kinds.includes(a.kind) && !t.actionProgress[a.id]?.doneAt,
    );
    if (action) {
      actionId = action.id;
      break;
    }
  }
  if (!actionId) {
    return { state, actionId: null, progress: pathOverallProgress(track, state) };
  }
  const next = markActionDone(track, actionId, score);
  return {
    state: next,
    actionId,
    progress: pathOverallProgress(track, next),
  };
}

/**
 * Tick the first unfinished day-level skill action (grammar/kanji/listening/mock)
 * on the earliest incomplete day — so finishing ngữ pháp does not get skipped
 * when vocab already advanced the queue.
 */
export function markCurrentDaySkill(
  track: TrackId,
  kinds: string[],
  score?: number,
): LearnState {
  const state = normalize(loadLearn());
  const t = getTrack(state, track);
  const weeks = t.roadmap?.weeks || [];
  for (const week of weeks) {
    for (const day of week.days || []) {
      if (isDayComplete(track, day, state)) continue;
      for (const a of day.actions || []) {
        if (!kinds.includes(a.kind)) continue;
        if (t.actionProgress[a.id]?.doneAt) continue;
        const next = markActionDone(track, a.id, score);
        if (day.lessonId && day.lessonKind && kinds.includes(day.lessonKind)) {
          return markLessonDone(track, day.lessonId);
        }
        return next;
      }
    }
  }
  // Fallback: week-level actions
  return markCurrentWeekAction(
    track,
    kinds as Array<RoadmapPlan["weeks"][0]["actions"][0]["kind"]>,
    score,
  ).state;
}

export function recordStudyMinutes(minutes: number) {
  const n = Math.min(90, Math.max(0, Math.round(minutes)));
  if (n <= 0) return loadLearn();
  const state = bumpActivity(normalize(loadLearn()), { minutes: n });
  saveLearn(state);
  return state;
}

export function studyStreak(state = loadLearn()): number {
  const s = normalize(state);
  const set = new Set(
    (s.activityLog || [])
      .filter((d) => d.minutes > 0 || d.reviews > 0 || d.actions > 0)
      .map((d) => d.day),
  );
  let streak = 0;
  const cursor = new Date();
  const today = todayKey();
  if (!set.has(today)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function activityLast7Days(state = loadLearn()): DayActivity[] {
  const s = normalize(state);
  const map = new Map((s.activityLog || []).map((d) => [d.day, d]));
  const out: DayActivity[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push(map.get(key) || { day: key, minutes: 0, reviews: 0, actions: 0 });
  }
  return out;
}

export function minutesToday(state = loadLearn()): number {
  const key = todayKey();
  return normalize(state).activityLog.find((d) => d.day === key)?.minutes || 0;
}

export type QueuedCard = HydratedCard & {
  live: ReturnType<typeof deserializeCard>;
  queueKind: "new" | "review";
};

export type DailyStudyProgress = {
  newCap: number;
  newDoneToday: number;
  newLeftToday: number;
  dueCount: number;
  untouched: number;
  touched: number;
  total: number;
  remainingQuota: number;
  /** Next new word preview (not a reset — continuation). */
  nextNewWord?: string;
  summary: string;
};

export function getDailyStudyProgress(
  track: TrackId,
  state = loadLearn(),
): DailyStudyProgress {
  const s = normalize(state);
  const t = getTrack(s, track);
  const intensity = (t.pathGoals?.intensity || "standard") as PathIntensity;
  const newCap = newCardsPerDay(intensity);
  const newDoneToday = s.newCardsToday || 0;
  const newLeftToday = Math.max(0, newCap - newDoneToday);
  const remainingQuota = Math.max(0, FREE_LIMITS.dailySrsReviews - s.reviewsToday);
  const now = Date.now();
  let dueCount = 0;
  let untouched = 0;
  let touched = 0;
  let nextNewWord: string | undefined;
  for (const c of t.cards) {
    const snap = coerceSnapshot(c.card);
    const live = deserializeCard(snap);
    if ((snap.reps ?? 0) > 0) {
      touched += 1;
      if (live.due.getTime() <= now) dueCount += 1;
    } else {
      untouched += 1;
      if (!nextNewWord) nextNewWord = hydrateCard(c).word;
    }
  }
  const total = t.cards.length;
  const summary =
    untouched === 0
      ? `Đã mở hết ${total} từ · hôm nay ôn ${dueCount} due (không reset).`
      : `Đã mở ${touched}/${total} · hôm nay còn ${newLeftToday} từ mới` +
        (dueCount ? ` + ${dueCount} ôn lại` : "") +
        (nextNewWord ? ` · tiếp: ${nextNewWord}` : "");
  return {
    newCap,
    newDoneToday,
    newLeftToday,
    dueCount,
    untouched,
    touched,
    total,
    remainingQuota,
    nextNewWord,
    summary,
  };
}

export function dueCards(track?: TrackId, state = loadLearn()): QueuedCard[] {
  const now = Date.now();
  const scoped = track
    ? getTrack(state, track).cards
    : [...state.jp.cards, ...state.en.cards].filter((c) => getTrack(state, c.track).pathActive);
  return scoped
    .map((c) => {
      const h = hydrateCard(c);
      const live = deserializeCard(coerceSnapshot(c.card));
      return {
        ...h,
        live,
        queueKind: ((live.reps ?? 0) > 0 ? "review" : "new") as "new" | "review",
      };
    })
    .filter((c) => c.live.due.getTime() <= now)
    .sort((a, b) => a.live.due.getTime() - b.live.due.getTime());
}

/**
 * Session queue for the current lesson (bài):
 * - New cards ONLY from this lesson’s vocabSourceIds (no future lessons/weeks).
 * - When freemium unlocked: no daily new/review caps — finish bài 1 → học bài 2 ngay.
 * - Soft ETA (newPerDay) is estimate only, not a hard stop.
 */
export function studyQueue(
  track: TrackId,
  state = loadLearn(),
  opts?: { lessonId?: string | null },
): QueuedCard[] {
  const s = normalize(state);
  const t = getTrack(s, track);
  const unlocked = freemiumUnlocked();
  const intensity = (t.pathGoals?.intensity || "standard") as PathIntensity;
  const softCap = newCardsPerDay(intensity);
  const newLeft = unlocked
    ? Number.MAX_SAFE_INTEGER
    : Math.max(0, softCap - (s.newCardsToday || 0));
  const remainingQuota = unlocked
    ? Number.MAX_SAFE_INTEGER
    : Math.max(0, FREE_LIMITS.dailySrsReviews - s.reviewsToday);
  if (!remainingQuota) return [];

  const forced = opts?.lessonId ? getLesson(opts.lessonId) : null;
  const today = getTodayPlan(track, s);
  const lessonIds = forced
    ? lessonVocabIds(forced)
    : today?.day.vocabSourceIds || [];
  const allowNew = new Set<string>(lessonIds);

  const now = Date.now();
  const hydrated = t.cards.map((c) => {
    const h = hydrateCard(c);
    return { ...h, live: deserializeCard(coerceSnapshot(c.card)) };
  });

  // Lesson work queue: never-rated OR last grade < Good (Again/Hard stay until pass quality)
  const lessonWork =
    allowNew.size > 0
      ? hydrated
          .filter((c) => allowNew.has(c.sourceId) && cardNeedsLessonPass(t, c.sourceId))
          .map((c) => ({
            ...c,
            queueKind: ((c.live.reps ?? 0) > 0 ? "review" : "new") as "new" | "review",
          }))
      : [];

  const dueOutsideLesson = hydrated
    .filter(
      (c) =>
        (c.live.reps ?? 0) > 0 &&
        c.live.due.getTime() <= now &&
        !(allowNew.size > 0 && allowNew.has(c.sourceId)),
    )
    .sort((a, b) => a.live.due.getTime() - b.live.due.getTime())
    .map((c) => ({ ...c, queueKind: "review" as const }));

  const workSlots = Math.min(newLeft + 50, remainingQuota, lessonWork.length);
  const dueSlots = unlocked
    ? Math.min(dueOutsideLesson.length, Math.max(5, remainingQuota - workSlots))
    : Math.max(0, remainingQuota - workSlots);
  const work = lessonWork.slice(0, workSlots);
  const due = dueOutsideLesson.slice(0, dueSlots);

  // Finish current lesson first — do not skip Again/Hard cards
  return unlocked ? [...work, ...due] : [...work, ...due];
}

export function canReview(state = loadLearn()) {
  if (freemiumUnlocked()) return true;
  return normalize(state).reviewsToday < FREE_LIMITS.dailySrsReviews;
}

export function canLookup(state = loadLearn()) {
  if (freemiumUnlocked()) return true;
  return normalize(state).lookupsToday < FREE_LIMITS.dailyLookups;
}

export function canTakeMock(state = loadLearn()) {
  if (freemiumUnlocked() || isProUser()) return true;
  return normalize(state).mocksThisMonth < FREE_LIMITS.mocksPerMonth;
}

export function recordMockTaken() {
  const state = normalize(loadLearn());
  state.mocksThisMonth += 1;
  saveLearn(state);
  return state;
}

export function recordLookup(track?: TrackId, query?: string, hitCount = 0) {
  const state = normalize(loadLearn());
  state.lookupsToday += 1;
  saveLearn(state);
  const tr = track || state.preferredTrack;
  if (query && hitCount > 0) {
    return recordLookupEvidence(tr, query, hitCount);
  }
  return state;
}

export function rateCard(sourceId: string, grade: Grade, track: TrackId) {
  const state = normalize(loadLearn());
  if (!freemiumUnlocked() && state.reviewsToday >= FREE_LIMITS.dailySrsReviews) {
    return {
      ok: false as const,
      reason: `Đã hết hạn mức ôn hôm nay (${FREE_LIMITS.dailySrsReviews}). Mai tiếp tục — không mất tiến độ.`,
      state,
    };
  }
  const t = getTrack(state, track);
  const idx = t.cards.findIndex((c) => c.sourceId === sourceId);
  if (idx < 0) return { ok: false as const, reason: "Không tìm thấy thẻ.", state };

  const current = deserializeCard(coerceSnapshot(t.cards[idx].card));
  const wasNew = (current.reps ?? 0) === 0;
  const nextCard = schedule(current, new Date(), grade);
  t.cards[idx] = {
    ...t.cards[idx],
    card: serializeCard(nextCard),
    lastGrade: Number(grade),
  };
  state.reviewsToday += 1;
  if (wasNew) state.newCardsToday = (state.newCardsToday || 0) + 1;
  let withAct = bumpActivity(state, { reviews: 1 });
  saveLearn(withAct);
  // Evidence + path % only after a real grade, not page open.
  withAct = recordReviewEvidence(track, sourceId, grade);
  return { ok: true as const, state: withAct };
}

/** Manual tick only if already ≥50% evidence — blocks empty skip. */
export function tryManualMarkAction(track: TrackId, actionId: string) {
  const state = normalize(loadLearn());
  const t = getTrack(state, track);
  const action = t.roadmap?.weeks.flatMap((w) => w.actions).find((a) => a.id === actionId);
  if (!action) {
    return { ok: false as const, reason: "Không tìm thấy việc trên lộ trình.", state };
  }
  const credit = actionCredit(t, action);
  if (credit < 0.5) {
    return {
      ok: false as const,
      reason: `Mới ${Math.round(credit * 100)}% — hãy ôn/tra/drill thêm rồi thử lại.`,
      state,
    };
  }
  return { ok: true as const, state: markActionDone(track, actionId) };
}

export function addManualCard(input: {
  track: TrackId;
  word: string;
  meanings: string[];
  reading?: string;
}) {
  const state = loadLearn();
  const t = getTrack(state, input.track);
  if (!t.pathActive) {
    return { ok: false as const, reason: "Hãy kích hoạt một lộ trình học trước.", state };
  }
  const card: SerializedCard = {
    sourceId: `manual-${crypto.randomUUID()}`,
    track: input.track,
    word: input.word,
    reading: input.reading,
    meanings: input.meanings,
    card: serializeCard(newCard(new Date())),
  };
  // Manual cards keep word/meanings embedded (no seed id).
  t.cards.unshift(card);
  saveLearn(state);
  return { ok: true as const, state };
}

export { Rating };

export function roadmapFor(
  track: TrackId,
  band: string,
  goals?: PathGoals | null,
): RoadmapPlan {
  return buildRoadmap(track, band, goals);
}
