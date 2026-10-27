/**
 * Desk-safe learn persistence — no vocab seeds, roadmap, gloss, or lessons.
 * Full Learn flows use learn-store.ts (which builds on this).
 */
"use client";

import {
  coerceSnapshot,
  newCard,
  serializeCard,
  type CardSnapshot,
} from "./fsrs";
import {
  emptyEvidence,
  normalizeEvidence,
  type PathEvidence,
} from "./path-evidence";
import {
  normalizePathGoals,
  type PathGoals,
} from "./path-goals";
import { STORAGE_KEYS } from "./storage-keys";
import type { RoadmapPlan } from "./roadmap";

export type TrackId = "jp" | "en";
export type { RoadmapPlan };

export type SerializedCard = {
  sourceId: string;
  track: TrackId;
  word?: string;
  reading?: string;
  meanings?: string[];
  exampleJa?: string;
  exampleEn?: string;
  card: CardSnapshot;
  lastGrade?: number;
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
  evidence: PathEvidence;
  pathStartedAt?: string | null;
  lessonProgress?: Record<string, { doneAt: string }>;
};

export const LEARN_PATHS_EPOCH = 8;

export type LearnState = {
  preferredTrack: TrackId;
  jp: TrackState;
  en: TrackState;
  reviewsToday: number;
  newCardsToday: number;
  lookupsToday: number;
  dayKey: string;
  mocksThisMonth: number;
  mockMonthKey: string;
  activityLog: DayActivity[];
  pathsEpoch?: number;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

export function emptyTrack(): TrackState {
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

export function defaultLearn(): LearnState {
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

export function normalize(state: LearnState): LearnState {
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

/**
 * Read learn state from localStorage without seeding beginner paths.
 * Safe for Desk — does not pull curriculum JSON.
 */
export function readLearn(): LearnState {
  if (typeof window === "undefined") return defaultLearn();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.learn);
    if (!raw) return defaultLearn();
    return migrate(JSON.parse(raw) as LearnState & Record<string, unknown>);
  } catch {
    return defaultLearn();
  }
}

export function saveLearn(state: LearnState) {
  localStorage.setItem(STORAGE_KEYS.learn, JSON.stringify(state));
}

export function getTrack(state: LearnState, track: TrackId): TrackState {
  return track === "jp" ? state.jp : state.en;
}

export function addManualCard(input: {
  track: TrackId;
  word: string;
  meanings: string[];
  reading?: string;
}) {
  const state = readLearn();
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
  t.cards.unshift(card);
  saveLearn(state);
  return { ok: true as const, state };
}
