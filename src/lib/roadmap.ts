import cefrj from "@/data/cefrj-vocab-seed.json";
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
import jpSeedN1 from "@/data/openjlpt-n1-seed.json";
import jpSeedN2 from "@/data/openjlpt-n2-seed.json";
import jpSeedN3 from "@/data/openjlpt-n3-seed.json";
import jpSeedN4 from "@/data/openjlpt-n4-seed.json";
import jpSeedN5 from "@/data/openjlpt-n5-seed.json";

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

export type RoadmapWeek = {
  week: number;
  title: string;
  goal: string;
  actions: RoadmapAction[];
  samples: string[];
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
  return [
    ...(jpSeedN5 as VocabSeed[]),
    ...(jpSeedN4 as VocabSeed[]),
    ...(jpSeedN3 as VocabSeed[]),
    ...(jpSeedN2 as VocabSeed[]),
    ...(jpSeedN1 as VocabSeed[]),
  ];
}

function allEn(): VocabSeed[] {
  return cefrj as VocabSeed[];
}

function jpVocabLevels(band: string): { primary: string; bridge?: string } {
  if (band === "N5") return { primary: "N5" };
  if (band === "N4") return { primary: "N4", bridge: "N5" };
  if (band === "N3") return { primary: "N3", bridge: "N4" };
  if (band === "N2") return { primary: "N2", bridge: "N3" };
  return { primary: "N1", bridge: "N2" };
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
  if (band === "A2") return ["A1", "A2"];
  if (band === "B1") return ["A2", "B1"];
  if (band === "B2") return ["B1", "B2"];
  return ["B2", "C1"];
}

function enGrammarLevels(band: string): string[] {
  if (band === "A2") return ["A1", "A2"];
  if (band === "B1") return ["A2", "B1"];
  if (band === "B2") return ["B1", "B2"];
  return ["B2", "C1"];
}

function pickVocab(list: VocabSeed[], n: number): VocabSeed[] {
  return list.slice(0, Math.min(n, list.length));
}

function sampleWords(list: VocabSeed[], n = 6): string[] {
  return list.slice(0, n).map((w) => w.word);
}

/** Vocab deck for a placement band — used to seed FSRS + roadmap counts. */
export function curriculumVocab(track: TrackId, band: string): VocabSeed[] {
  if (track === "jp") {
    const all = allJp();
    const { primary, bridge } = jpVocabLevels(band);
    const primaryPool = all.filter((w) => w.level === primary);
    const bridgePool = bridge ? all.filter((w) => w.level === bridge) : [];
    const primaryN =
      primary === "N5" ? 120 : primary === "N4" ? 100 : primary === "N3" ? 100 : 90;
    const bridgeN = bridge ? 40 : 0;
    return [...pickVocab(bridgePool, bridgeN), ...pickVocab(primaryPool, primaryN)];
  }
  const levels = new Set(enVocabLevels(band));
  const pool = allEn().filter((w) => levels.has(w.level));
  const n = band === "A2" ? 80 : band === "B1" ? 100 : band === "B2" ? 120 : 140;
  return pickVocab(pool.length ? pool : allEn(), n);
}

export function buildRoadmap(track: TrackId, band: string): RoadmapPlan {
  const generatedAt = new Date().toISOString();
  const vocab = curriculumVocab(track, band);
  const vocabSourceIds = vocab.map((w) => w.id);
  return track === "jp"
    ? buildJpRoadmap(band, vocab, vocabSourceIds, generatedAt)
    : buildEnRoadmap(band, vocab, vocabSourceIds, generatedAt);
}

function buildJpRoadmap(
  band: string,
  vocab: VocabSeed[],
  vocabSourceIds: string[],
  generatedAt: string,
): RoadmapPlan {
  const { primary, bridge } = jpVocabLevels(band);
  const kLevel = jpKanjiLevel(band);
  const gLevels = jpGrammarLevels(band);
  const kanjiBank = KANJI[kLevel] || [];
  const grammar = (grammarJp as GrammarItem[]).filter((g) => gLevels.includes(g.level));
  const primaryCount = vocab.filter((w) => w.level === primary).length;
  const bridgeCount = bridge ? vocab.filter((w) => w.level === bridge).length : 0;
  const mockQ = (mocksJp as { questions?: unknown[] }).questions?.length || 0;
  const listenQ =
    (mocksListeningJp as { questions?: unknown[] }).questions?.length || 0;

  const weeks: RoadmapWeek[] = [
    {
      week: 1,
      title: bridge ? `Ôn cầu ${bridge} + mở ${primary}` : `Nền từ vựng ${primary}`,
      goal: `Đưa ${vocab.length} từ OpenJLPT vào SRS (FSRS) theo band ${band}.`,
      samples: sampleWords(vocab),
      actions: [
        {
          id: "w1-review",
          kind: "review",
          title: "Ôn SRS hàng ngày",
          detail: `${vocab.length} thẻ đã nạp · ưu tiên due hôm nay`,
          href: "/learn/review?track=jp",
          count: vocab.length,
        },
        {
          id: "w1-dict",
          kind: "dictionary",
          title: "Tra cứu OpenJLPT",
          detail: `Ngân hàng N5–N1 · tập trung ${primary}${bridge ? ` (+ ${bridge})` : ""}`,
          href: "/learn/dictionary?track=jp",
        },
      ],
    },
    {
      week: 2,
      title: `Kanji ${kLevel}`,
      goal: `Luyện ${kanjiBank.length} chữ OpenJLPT ${kLevel} (flash + âm đọc).`,
      samples: kanjiBank.slice(0, 8).map((k) => k.character),
      actions: [
        {
          id: "w2-kanji",
          kind: "kanji",
          title: `Flashcard kanji ${kLevel}`,
          detail: `${kanjiBank.length} chữ trong bộ ${kLevel}`,
          href: `/learn/kanji?level=${kLevel}`,
          count: kanjiBank.length,
        },
        {
          id: "w2-review",
          kind: "review",
          title: "Giữ nhịp SRS từ vựng",
          detail: "Kanji + vocab song song",
          href: "/learn/review?track=jp",
        },
      ],
    },
    {
      week: 3,
      title: `Ngữ pháp ${gLevels.join(" · ")}`,
      goal: `Làm hết ${grammar.length} mẫu grammar trong app (không phải đề JLPT chính thức).`,
      samples: grammar.slice(0, 6).map((g) => g.pattern),
      actions: [
        {
          id: "w3-grammar",
          kind: "grammar",
          title: "Grammar drills",
          detail:
            grammar
              .map((g) => g.pattern)
              .slice(0, 4)
              .join(" · ") || "Drills theo level",
          href: `/learn/grammar?track=jp&level=${gLevels[gLevels.length - 1]}`,
          count: grammar.length,
        },
      ],
    },
    {
      week: 4,
      title: "Củng cố + mở rộng",
      goal: "Ôn thẻ khó (Again/Hard) và tra từ mới liên quan band.",
      samples: sampleWords(vocab.slice(Math.floor(vocab.length / 2))),
      actions: [
        {
          id: "w4-review",
          kind: "review",
          title: "SRS củng cố",
          detail: `${primaryCount} từ ${primary}${bridgeCount ? ` · ${bridgeCount} cầu ${bridge}` : ""}`,
          href: "/learn/review?track=jp",
          count: vocab.length,
        },
        {
          id: "w4-dict",
          kind: "dictionary",
          title: "Dictionary theo band",
          detail: "Thêm thẻ thủ công nếu gặp từ ngoài deck",
          href: "/learn/dictionary?track=jp",
        },
      ],
    },
    {
      week: 5,
      title: "Nghe (TTS mock)",
      goal: `Mock nghe không chính thức · ${listenQ} câu.`,
      samples: [],
      actions: [
        {
          id: "w5-listen",
          kind: "listening",
          title: "Listening mock",
          detail: `${listenQ} câu · Web Speech TTS`,
          href: "/learn/mocks?track=jp&mode=listening",
          count: listenQ,
        },
      ],
    },
    {
      week: 6,
      title: "Checkpoint vocab mock",
      goal: `Mock từ vựng (${mockQ} câu) để kiểm tra nhịp trước khi nâng band.`,
      samples: [],
      actions: [
        {
          id: "w6-mock",
          kind: "mock",
          title: "Vocab section mock",
          detail: `${mockQ} câu · có đồng hồ`,
          href: "/learn/mocks?track=jp&mode=vocab",
          count: mockQ,
        },
        {
          id: "w6-review",
          kind: "review",
          title: "Ôn lại thẻ miss",
          detail: "Sau mock, quay SRS các từ còn Again",
          href: "/learn/review?track=jp",
        },
      ],
    },
  ];

  return {
    track: "jp",
    band,
    generatedAt,
    summary: `Lộ trình ${band} từ OpenJLPT trong app: ${vocab.length} từ (SRS), ${kanjiBank.length} kanji ${kLevel}, ${grammar.length} mẫu grammar, mocks nghe + từ vựng.`,
    inventory: {
      vocab: vocab.length,
      kanji: kanjiBank.length,
      grammar: grammar.length,
      mocks: 2,
    },
    weeks,
    vocabSourceIds,
  };
}

function buildEnRoadmap(
  band: string,
  vocab: VocabSeed[],
  vocabSourceIds: string[],
  generatedAt: string,
): RoadmapPlan {
  const vLevels = enVocabLevels(band);
  const gLevels = enGrammarLevels(band);
  const grammar = (grammarEn as GrammarItem[]).filter((g) => gLevels.includes(g.level));
  const levelCounts = vLevels
    .map((lv) => `${vocab.filter((w) => w.level === lv).length} ${lv}`)
    .join(" · ");
  const mockQ = (mocksEn as { questions?: unknown[] }).questions?.length || 0;
  const listenQ =
    (mocksListeningEn as { questions?: unknown[] }).questions?.length || 0;
  const dataNote = `CEFR-J/Octanove A1–C2 trong app · band ${band} dùng ${vLevels.join("+")}; grammar ${gLevels.join("/")}.`;

  const weeks: RoadmapWeek[] = [
    {
      week: 1,
      title: "Nền từ vựng CEFR",
      goal: `Nạp ${vocab.length} từ (${vLevels.join(" + ")}) vào SRS.`,
      samples: sampleWords(vocab),
      actions: [
        {
          id: "w1-review",
          kind: "review",
          title: "Ôn SRS mỗi ngày",
          detail: `${levelCounts} trong deck`,
          href: "/learn/review?track=en",
          count: vocab.length,
        },
        {
          id: "w1-dict",
          kind: "dictionary",
          title: "Dictionary + gloss VI",
          detail: "CEFR-J A1–B2 + Octanove C1/C2 · nhãn từ loại VI",
          href: "/learn/dictionary?track=en",
        },
      ],
    },
    {
      week: 2,
      title: `Ngữ pháp ${gLevels.join(" · ")}`,
      goal: `Làm ${grammar.length} drills grammar khớp band.`,
      samples: grammar.map((g) => g.pattern).slice(0, 6),
      actions: [
        {
          id: "w2-grammar",
          kind: "grammar",
          title: "Grammar drills",
          detail: grammar
            .map((g) => g.pattern)
            .slice(0, 4)
            .join(" · "),
          href: `/learn/grammar?track=en&level=${gLevels[gLevels.length - 1]}`,
          count: grammar.length,
        },
      ],
    },
    {
      week: 3,
      title: "Củng cố SRS",
      goal: "Giảm thẻ Again/Hard; thêm từ dictionary nếu cần.",
      samples: sampleWords(vocab.slice(20)),
      actions: [
        {
          id: "w3-review",
          kind: "review",
          title: "Review bền",
          detail: `${vocab.length} thẻ trong path`,
          href: "/learn/review?track=en",
          count: vocab.length,
        },
        {
          id: "w3-dict",
          kind: "dictionary",
          title: "Bổ sung từ",
          detail: "Thêm thẻ thủ công từ lookup",
          href: "/learn/dictionary?track=en",
        },
      ],
    },
    {
      week: 4,
      title: "Nghe + vocab mock",
      goal: `Checkpoint: nghe ${listenQ} câu + vocab ${mockQ} câu.`,
      samples: [],
      actions: [
        {
          id: "w4-listen",
          kind: "listening",
          title: "Listening mock",
          detail: `${listenQ} câu TTS`,
          href: "/learn/mocks?track=en&mode=listening",
          count: listenQ,
        },
        {
          id: "w4-mock",
          kind: "mock",
          title: "Vocab mock",
          detail: `${mockQ} câu có đồng hồ`,
          href: "/learn/mocks?track=en&mode=vocab",
          count: mockQ,
        },
      ],
    },
  ];

  return {
    track: "en",
    band,
    generatedAt,
    summary: `Lộ trình ${band}: ${dataNote} Deck SRS ${vocab.length} từ · ${grammar.length} grammar · 2 mock trong app.`,
    inventory: {
      vocab: vocab.length,
      kanji: 0,
      grammar: grammar.length,
      mocks: 2,
    },
    weeks,
    vocabSourceIds,
  };
}
