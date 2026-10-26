export type PathGoalFocus = "jlpt" | "exam_en" | "daily" | "business";
export type PathIntensity = "light" | "standard" | "intense";
export type PathSkill = "vocab" | "grammar" | "listening";

export type PathGoals = {
  focus: PathGoalFocus;
  skills: PathSkill[];
  intensity: PathIntensity;
  examDate?: string;
};

export const DEFAULT_PATH_GOALS: PathGoals = {
  focus: "daily",
  skills: ["vocab", "grammar"],
  intensity: "standard",
};

export function normalizePathGoals(raw: Partial<PathGoals> | null | undefined): PathGoals {
  const focus =
    raw?.focus === "jlpt" ||
    raw?.focus === "exam_en" ||
    raw?.focus === "daily" ||
    raw?.focus === "business"
      ? raw.focus
      : DEFAULT_PATH_GOALS.focus;
  const intensity =
    raw?.intensity === "light" ||
    raw?.intensity === "standard" ||
    raw?.intensity === "intense"
      ? raw.intensity
      : DEFAULT_PATH_GOALS.intensity;
  const skills = Array.isArray(raw?.skills)
    ? raw.skills.filter(
        (s): s is PathSkill => s === "vocab" || s === "grammar" || s === "listening",
      )
    : [];
  return {
    focus,
    intensity,
    skills: skills.length ? skills : [...DEFAULT_PATH_GOALS.skills],
    examDate: raw?.examDate?.trim() || undefined,
  };
}

export function goalsLabel(goals: PathGoals, track: "jp" | "en"): string {
  const focus =
    goals.focus === "jlpt"
      ? "JLPT"
      : goals.focus === "exam_en"
        ? "Exam EN"
        : goals.focus === "business"
          ? "Business"
          : "Daily";
  const inten =
    goals.intensity === "light"
      ? "nhẹ"
      : goals.intensity === "intense"
        ? "đậm"
        : "chuẩn";
  return `${track.toUpperCase()} · ${focus} · ${inten} · ${goals.skills.join("+")}`;
}

/** New SRS cards introduced per day (intensity pace — not deck size). */
export function newCardsPerDay(intensity: PathIntensity): number {
  if (intensity === "light") return 15;
  if (intensity === "intense") return 40;
  return 25;
}

export type PathScheduleEstimate = {
  poolSize: number;
  newPerDay: number;
  etaDays: number;
  etaWeeks: number;
};

/** Soft ETA from full primary pool size; buffer ×1.25 for reviews. */
export function estimatePathSchedule(
  poolSize: number,
  intensity: PathIntensity,
): PathScheduleEstimate {
  const newPerDay = newCardsPerDay(intensity);
  const n = Math.max(0, poolSize);
  const etaDays = Math.max(7, Math.ceil((n / Math.max(1, newPerDay)) * 1.25));
  const etaWeeks = Math.max(4, Math.ceil(etaDays / 7));
  return { poolSize: n, newPerDay, etaDays, etaWeeks };
}
