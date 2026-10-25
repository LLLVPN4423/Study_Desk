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
import enSeed from "@/data/cefrj-a1a2-seed.json";

export type TrackId = "jp" | "en";
export type JpBand = "N5" | "N4" | "N3" | "N2" | "N1";
export type EnBand = "A2" | "B1" | "B2" | "C1";

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
  return { band: null, placementDone: false, pathActive: false, cards: [] };
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
    },
    reviewsToday: Number(raw.reviewsToday) || 0,
    lookupsToday: Number(raw.lookupsToday) || 0,
    dayKey: String(raw.dayKey || todayKey()),
  });
}

function normalize(state: LearnState): LearnState {
  let next = { ...state };
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

function jpPool(band: string): VocabSeed[] {
  const all = getJpSeed();
  const by = (lv: string) => all.filter((w) => w.level === lv);
  if (band === "N5") return by("N5").slice(0, 100);
  if (band === "N4") return [...by("N5").slice(0, 40), ...by("N4").slice(0, 100)];
  if (band === "N3") return [...by("N4").slice(0, 40), ...by("N3").slice(0, 120)];
  if (band === "N2") return [...by("N3").slice(0, 40), ...by("N2").slice(0, 120)];
  return [...by("N2").slice(0, 40), ...by("N1").slice(0, 100)];
}

function seedCards(track: TrackId, band: string): SerializedCard[] {
  if (track === "jp") {
    return jpPool(band).map((w) => ({
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
  const count = band === "A2" ? 40 : band === "B1" ? 60 : 80;
  return getEnSeed()
    .slice(0, count)
    .map((w) => ({
      sourceId: w.id,
      track,
      word: w.word,
      meanings: w.meanings,
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
  t.band = band;
  t.placementDone = true;
  t.pathActive = true;
  t.cards = seedCards(track, band);
  state.preferredTrack = track;
  saveLearn(state);
  return state;
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

export function roadmapFor(track: TrackId, band: string) {
  if (track === "en") {
    const templates: Record<string, { week: number; title: string; focus: string }[]> = {
      A2: [
        { week: 1, title: "Từ vựng A2 cốt lõi", focus: "Ôn CEFR-J mỗi ngày + đọc ngắn." },
        { week: 2, title: "Hiện tại & quá khứ", focus: "Luyện grammar trên Learn." },
        { week: 3, title: "Nghe trên bàn học", focus: "Upload MP3 + mock listening TTS." },
        { week: 4, title: "Viết ngắn", focus: "5 câu mỗi ngày trong Tasks." },
      ],
      B1: [
        { week: 1, title: "Mở rộng B1", focus: "Tăng SRS từ CEFR-J." },
        { week: 2, title: "Điều kiện & hoàn thành", focus: "Grammar drills." },
        { week: 3, title: "Đọc bền", focus: "Ghi chú PDF trên desk." },
        { week: 4, title: "Mock từ vựng/nghe", focus: "1 mock Free / tháng." },
      ],
      B2: [
        { week: 1, title: "Sắc thái từ", focus: "Thẻ khó hơn trong reviews." },
        { week: 2, title: "Bị động & mệnh đề quan hệ", focus: "Grammar." },
        { week: 3, title: "Đọc dày", focus: "Highlight → flashcard." },
        { week: 4, title: "Section mock", focus: "Luyện có đồng hồ." },
      ],
      C1: [
        { week: 1, title: "Từ học thuật", focus: "Dictionary + SRS." },
        { week: 2, title: "Ngữ pháp phức", focus: "Inversion / reporting." },
        { week: 3, title: "Nghe dài", focus: "MP3 trên desk." },
        { week: 4, title: "Mock đầy đủ (Pro)", focus: "Thêm mock khi bật Pro." },
      ],
    };
    return templates[band] || templates.A2;
  }
  const templates: Record<string, { week: number; title: string; focus: string }[]> = {
    N5: [
      { week: 1, title: "Hiragana vững", focus: "Động từ & chào hỏi N5." },
      { week: 2, title: "Danh từ đời sống", focus: "SRS + kanji N5." },
      { week: 3, title: "て-form", focus: "Grammar drills." },
      { week: 4, title: "Nghe ngắn", focus: "Mock listening TTS." },
    ],
    N4: [
      { week: 1, title: "Cầu N4", focus: "Trộn N5 + N4 vocab." },
      { week: 2, title: "Khả năng & ý muốn", focus: "Grammar + kanji N4." },
      { week: 3, title: "Đọc", focus: "PDF trên desk." },
      { week: 4, title: "Nghe", focus: "MP3 + TTS mock." },
    ],
    N3: [
      { week: 1, title: "Bùng từ N3", focus: "Seed N3 + ôn N4." },
      { week: 2, title: "Mệnh đề phức", focus: "Grammar N3." },
      { week: 3, title: "Đọc tin nhẹ", focus: "Highlight → thẻ." },
      { week: 4, title: "Output", focus: "Viết 5 câu / ngày." },
    ],
    N2: [
      { week: 1, title: "Từ chính xác", focus: "N2 seed + kanji N2." },
      { week: 2, title: "Đọc dày", focus: "PDF + timer." },
      { week: 3, title: "Nghe bền", focus: "MP3 dài." },
      { week: 4, title: "Section mock", focus: "Mock hẹn giờ." },
    ],
    N1: [
      { week: 1, title: "Từ nâng cao", focus: "N1 seed (subset)." },
      { week: 2, title: "Đọc học thuật", focus: "Desk PDF." },
      { week: 3, title: "Ngữ pháp tinh", focus: "Drills N2/N1." },
      { week: 4, title: "Mock tổng hợp", focus: "Vocab + listening TTS." },
    ],
  };
  return templates[band] || templates.N5;
}
