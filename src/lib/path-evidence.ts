/** Thresholds: user must produce real study signals — not just open a page. */
export const EVIDENCE = {
  /** Distinct SRS cards rated (Again/Hard/Good/Easy). */
  reviewUnique: 8,
  /** After ≥5 ratings, share of Good+Easy for “học tốt”. */
  reviewQualityFloor: 0.35,
  /** Distinct dictionary queries that returned ≥1 hit. */
  dictionaryUnique: 5,
  /** Kanji marked “known” in flash (not skipped). */
  kanjiKnown: 8,
  /** Grammar items answered correctly in drills. */
  grammarCorrect: 6,
  /** Min mock score % to count as pass. */
  mockMinScore: 40,
} as const;

export type PathEvidence = {
  reviewIds: string[];
  grades: { again: number; hard: number; good: number; easy: number };
  lookupKeys: string[];
  kanjiKnown: string[];
  grammarCorrectIds: string[];
  mockBest: { vocab: number; listening: number };
};

export function emptyEvidence(): PathEvidence {
  return {
    reviewIds: [],
    grades: { again: 0, hard: 0, good: 0, easy: 0 },
    lookupKeys: [],
    kanjiKnown: [],
    grammarCorrectIds: [],
    mockBest: { vocab: 0, listening: 0 },
  };
}

export function normalizeEvidence(raw: Partial<PathEvidence> | null | undefined): PathEvidence {
  const base = emptyEvidence();
  if (!raw) return base;
  return {
    reviewIds: Array.isArray(raw.reviewIds) ? [...new Set(raw.reviewIds.map(String))].slice(-400) : [],
    grades: {
      again: Number(raw.grades?.again) || 0,
      hard: Number(raw.grades?.hard) || 0,
      good: Number(raw.grades?.good) || 0,
      easy: Number(raw.grades?.easy) || 0,
    },
    lookupKeys: Array.isArray(raw.lookupKeys)
      ? [...new Set(raw.lookupKeys.map((k) => String(k).toLowerCase().trim()).filter(Boolean))].slice(
          -200,
        )
      : [],
    kanjiKnown: Array.isArray(raw.kanjiKnown)
      ? [...new Set(raw.kanjiKnown.map(String))].slice(-500)
      : [],
    grammarCorrectIds: Array.isArray(raw.grammarCorrectIds)
      ? [...new Set(raw.grammarCorrectIds.map(String))].slice(-300)
      : [],
    mockBest: {
      vocab: Math.min(100, Math.max(0, Number(raw.mockBest?.vocab) || 0)),
      listening: Math.min(100, Math.max(0, Number(raw.mockBest?.listening) || 0)),
    },
  };
}

export function gradeKey(grade: number): keyof PathEvidence["grades"] | null {
  // ts-fsrs Rating: 1 Again, 2 Hard, 3 Good, 4 Easy
  if (grade === 1) return "again";
  if (grade === 2) return "hard";
  if (grade === 3) return "good";
  if (grade === 4) return "easy";
  return null;
}

export function reviewQuality(ev: PathEvidence): number {
  const t = ev.grades.again + ev.grades.hard + ev.grades.good + ev.grades.easy;
  if (t < 5) return 0;
  return (ev.grades.good + ev.grades.easy) / t;
}

/** 0..1 how done this action kind is, from evidence only. */
export function evidenceCreditForKind(
  kind: string,
  ev: PathEvidence,
): number {
  switch (kind) {
    case "review":
    case "vocab":
      return Math.min(1, ev.reviewIds.length / EVIDENCE.reviewUnique);
    case "dictionary":
      return Math.min(1, ev.lookupKeys.length / EVIDENCE.dictionaryUnique);
    case "kanji":
      return Math.min(1, ev.kanjiKnown.length / EVIDENCE.kanjiKnown);
    case "grammar":
      return Math.min(1, ev.grammarCorrectIds.length / EVIDENCE.grammarCorrect);
    case "mock":
      return ev.mockBest.vocab >= EVIDENCE.mockMinScore ? 1 : ev.mockBest.vocab / EVIDENCE.mockMinScore;
    case "listening":
      return ev.mockBest.listening >= EVIDENCE.mockMinScore
        ? 1
        : ev.mockBest.listening / EVIDENCE.mockMinScore;
    default:
      return 0;
  }
}

export type PathAdvice = {
  status: "on_track" | "need_practice" | "ready_next" | "consider_relevel";
  title: string;
  detail: string;
  href?: string;
};

export function buildPathAdvice(input: {
  track: "jp" | "en";
  band: string | null;
  overall: number;
  weekPct: number;
  weekIndex: number;
  weekCount: number;
  ev: PathEvidence;
  masteryPct?: number;
  stablePct?: number;
}): PathAdvice {
  const q = reviewQuality(input.ev);
  const rated =
    input.ev.grades.again + input.ev.grades.hard + input.ev.grades.good + input.ev.grades.easy;
  const mastery = input.masteryPct ?? 0;
  const stable = input.stablePct ?? 0;
  const mockOk = input.ev.mockBest.vocab >= 60 || input.ev.mockBest.listening >= 60;

  if (mastery >= 85 && stable >= 50 && mockOk) {
    return {
      status: "consider_relevel",
      title: "Có tín hiệu lên trình",
      detail: `Mastery ~${mastery}% · stable ~${stable}% và mock đạt. Trên hub Learn bấm «Nâng band» (cover 100% không đủ một mình).`,
      href: `/learn?track=${input.track}`,
    };
  }

  if (input.weekPct >= 80 && input.weekIndex < input.weekCount - 1) {
    return {
      status: "ready_next",
      title: `Tuần ${input.weekIndex + 1} đạt yêu cầu`,
      detail: "Đã có đủ chứng cứ học cho tuần này — tiếp tục việc chưa xong của tuần sau.",
      href: `/learn/roadmap?track=${input.track}`,
    };
  }

  if (rated >= 8 && q > 0 && q < EVIDENCE.reviewQualityFloor) {
    return {
      status: "need_practice",
      title: "Đang ôn nhưng chưa vững",
      detail: `Tỷ lệ Good/Easy ${(q * 100).toFixed(0)}% — nên ôn lại SRS và grammar trước khi sang tuần mới.`,
      href: `/learn/review?track=${input.track}`,
    };
  }

  if (input.ev.reviewIds.length < 3 && input.ev.lookupKeys.length < 2) {
    return {
      status: "need_practice",
      title: "Chưa có chứng cứ học rõ",
      detail:
        "Cần ôn SRS (chấm Again/Hard/Good/Easy), tra dictionary ra kết quả, hoặc hoàn thành drill — chỉ mở trang không tính.",
      href: `/learn/review?track=${input.track}`,
    };
  }

  return {
    status: "on_track",
    title: "Đang học có kiểm chứng",
    detail: `Band ~${input.band || "?"} · tuần ${input.weekIndex + 1}/${input.weekCount} · lộ trình ${input.overall}%.`,
    href: `/learn/roadmap?track=${input.track}`,
  };
}
