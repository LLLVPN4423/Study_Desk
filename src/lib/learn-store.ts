"use client";

import { FREE_LIMITS } from "./freemium";
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
  buildRoadmap,
  curriculumVocab,
  type RoadmapPlan,
  type VocabSeed,
} from "./roadmap";

export type TrackId = "jp" | "en";
export type JpBand = "N5" | "N4" | "N3" | "N2" | "N1";
export type EnBand = "A2" | "B1" | "B2" | "C1";
export type { VocabSeed, RoadmapPlan };

export type SerializedCard = {
  sourceId: string;
  track: TrackId;
  word: string;
  reading?: string;
  meanings: string[];
  exampleJa?: string;
  exampleEn?: string;
  card: CardSnapshot;
};

type TrackState = {
  band: string | null;
  placementDone: boolean;
  pathActive: boolean;
  cards: SerializedCard[];
  roadmap: RoadmapPlan | null;
};

export type LearnState = {
  preferredTrack: TrackId;
  jp: TrackState;
  en: TrackState;
  reviewsToday: number;
  lookupsToday: number;
  dayKey: string;
  mocksThisMonth: number;
  mockMonthKey: string;
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
  };
}

function defaultLearn(): LearnState {
  return {
    preferredTrack: "jp",
    jp: emptyTrack(),
    en: emptyTrack(),
    reviewsToday: 0,
    lookupsToday: 0,
    dayKey: todayKey(),
    mocksThisMonth: 0,
    mockMonthKey: monthKey(),
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
    },
    reviewsToday: Number(raw.reviewsToday) || 0,
    lookupsToday: Number(raw.lookupsToday) || 0,
    dayKey: String(raw.dayKey || todayKey()),
  });
}

function normalize(state: LearnState): LearnState {
  let next = { ...state };
  if (!next.jp) next.jp = emptyTrack();
  if (!next.en) next.en = emptyTrack();
  if (next.jp.roadmap === undefined) next.jp = { ...next.jp, roadmap: null };
  if (next.en.roadmap === undefined) next.en = { ...next.en, roadmap: null };
  if (next.dayKey !== todayKey()) {
    next = { ...next, dayKey: todayKey(), reviewsToday: 0, lookupsToday: 0 };
  }
  if (next.mockMonthKey !== monthKey()) {
    next = { ...next, mockMonthKey: monthKey(), mocksThisMonth: 0 };
  }
  return next;
}

function isProUser() {
  return loadSession()?.plan === "pro";
}

export function loadLearn(): LearnState {
  if (typeof window === "undefined") return defaultLearn();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.learn);
    if (!raw) return defaultLearn();
    return migrate(JSON.parse(raw));
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
  return enSeed as VocabSeed[];
}

export function searchVocab(query: string, track: TrackId = "jp", limit = 8): VocabSeed[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const list = track === "jp" ? getJpSeed() : getEnSeed();
  return list
    .filter(
      (w) =>
        w.word.toLowerCase().includes(q) ||
        (w.reading || "").includes(q) ||
        (w.romaji || "").toLowerCase().includes(q) ||
        w.meanings.some((m) => m.toLowerCase().includes(q)),
    )
    .slice(0, limit);
}

function seedCards(track: TrackId, band: string): SerializedCard[] {
  return curriculumVocab(track, band).map((w) => ({
    sourceId: w.id,
    track,
    word: w.word,
    reading: w.reading,
    meanings: w.meanings,
    exampleJa: w.examples?.[0]?.ja,
    exampleEn: w.examples?.[0]?.en,
    card: serializeCard(newCard(new Date())),
  }));
}

export function activatePath(track: TrackId, band: string) {
  const state = loadLearn();
  if (!isProUser()) {
    state.jp.pathActive = false;
    state.en.pathActive = false;
  }
  const t = track === "jp" ? state.jp : state.en;
  const plan = buildRoadmap(track, band);
  t.band = band;
  t.placementDone = true;
  t.pathActive = true;
  t.roadmap = plan;
  t.cards = seedCards(track, band);
  state.preferredTrack = track;
  saveLearn(state);
  return state;
}

/** Ensure older desks get a real roadmap after placement without re-testing. */
export function ensureRoadmap(track: TrackId) {
  const state = loadLearn();
  const t = getTrack(state, track);
  if (!t.placementDone || !t.band) return state;
  if (t.roadmap?.band === t.band && t.roadmap.weeks?.length) return state;
  t.roadmap = buildRoadmap(track, t.band);
  if (!t.cards.length) t.cards = seedCards(track, t.band);
  saveLearn(state);
  return state;
}

/** Rough path progress from FSRS: reviewed at least once / total cards. */
export function pathProgress(track: TrackId, state = loadLearn()) {
  const t = getTrack(state, track);
  if (!t.pathActive || !t.cards.length) return 0;
  const touched = t.cards.filter((c) => (c.card?.reps ?? 0) > 0).length;
  return Math.round((touched / t.cards.length) * 100);
}

export function dueCards(track?: TrackId, state = loadLearn()) {
  const now = Date.now();
  const scoped = track
    ? getTrack(state, track).cards
    : [...state.jp.cards, ...state.en.cards].filter((c) => getTrack(state, c.track).pathActive);
  return scoped
    .map((c) => ({ ...c, live: deserializeCard(coerceSnapshot(c.card)) }))
    .filter((c) => c.live.due.getTime() <= now)
    .sort((a, b) => a.live.due.getTime() - b.live.due.getTime());
}

export function canReview(state = loadLearn()) {
  return normalize(state).reviewsToday < FREE_LIMITS.dailySrsReviews;
}

export function canLookup(state = loadLearn()) {
  return normalize(state).lookupsToday < FREE_LIMITS.dailyLookups;
}

export function canTakeMock(state = loadLearn()) {
  const s = normalize(state);
  if (isProUser()) return true;
  return s.mocksThisMonth < FREE_LIMITS.mocksPerMonth;
}

export function recordMockTaken() {
  const state = normalize(loadLearn());
  state.mocksThisMonth += 1;
  saveLearn(state);
  return state;
}

export function recordLookup() {
  const state = normalize(loadLearn());
  state.lookupsToday += 1;
  saveLearn(state);
  return state;
}

export function rateCard(sourceId: string, grade: Grade, track: TrackId) {
  const state = normalize(loadLearn());
  if (state.reviewsToday >= FREE_LIMITS.dailySrsReviews) {
    return { ok: false as const, reason: "Đã hết hạn mức ôn Free hôm nay (20).", state };
  }
  const t = getTrack(state, track);
  const idx = t.cards.findIndex((c) => c.sourceId === sourceId);
  if (idx < 0) return { ok: false as const, reason: "Không tìm thấy thẻ.", state };

  const current = deserializeCard(coerceSnapshot(t.cards[idx].card));
  const next = schedule(current, new Date(), grade);
  t.cards[idx] = { ...t.cards[idx], card: serializeCard(next) };
  state.reviewsToday += 1;
  saveLearn(state);
  return { ok: true as const, state };
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
  t.cards.unshift(card);
  saveLearn(state);
  return { ok: true as const, state };
}

export { Rating };

export function roadmapFor(track: TrackId, band: string): RoadmapPlan {
  return buildRoadmap(track, band);
}
