import type { TrackId } from "./roadmap";
import type { PathGoals } from "./path-goals";
import { normalizePathGoals } from "./path-goals";

export type PlacementQuestion = {
  id: string;
  bandHint: string;
  label: string;
  prompt: string;
  translation?: string;
  hint?: string;
  /** If set, quiz shows TTS play before answering (listening item). */
  speak?: string;
  choices: string[];
  answer: number;
};

export type SkillScores = {
  vocab: { correct: number; total: number };
  grammar: { correct: number; total: number };
  listening: { correct: number; total: number };
  other: { correct: number; total: number };
};

export type PlacementResult = {
  band: string;
  correct: number;
  total: number;
  skills: SkillScores;
  weak: ("vocab" | "grammar" | "listening")[];
  strong: ("vocab" | "grammar" | "listening")[];
};

const JP_BANDS = ["N5", "N4", "N3", "N2", "N1"] as const;
const EN_BANDS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

function skillOf(q: PlacementQuestion): keyof SkillScores {
  const l = (q.label || "").toLowerCase();
  if (l.includes("listen") || q.speak) return "listening";
  if (l.includes("vocab")) return "vocab";
  if (l.includes("grammar")) return "grammar";
  return "other";
}

function bandIndex(track: TrackId, band: string): number {
  const list = track === "jp" ? JP_BANDS : EN_BANDS;
  const i = (list as readonly string[]).indexOf(band);
  return i >= 0 ? i : 0;
}

function bandAt(track: TrackId, index: number): string {
  const list = track === "jp" ? JP_BANDS : EN_BANDS;
  return list[Math.min(list.length - 1, Math.max(0, index))];
}

function bandsFor(track: TrackId): readonly string[] {
  return track === "jp" ? JP_BANDS : EN_BANDS;
}

function groupByBand(bank: PlacementQuestion[]): Map<string, PlacementQuestion[]> {
  const map = new Map<string, PlacementQuestion[]>();
  for (const q of bank) {
    const k = q.bandHint || "?";
    const arr = map.get(k) || [];
    arr.push(q);
    map.set(k, arr);
  }
  return map;
}

/** Take up to n items from list, preferring listening items last in stage2. */
function take(list: PlacementQuestion[], n: number): PlacementQuestion[] {
  return list.slice(0, Math.min(n, list.length));
}

/**
 * Stage 1: ~1–2 items from mid bands + light sample of lower.
 * Stage 2 easy/hard: remaining by band difficulty.
 */
export function buildPlacementStages(
  track: TrackId,
  bank: PlacementQuestion[],
): { stage1: PlacementQuestion[]; stage2Easy: PlacementQuestion[]; stage2Hard: PlacementQuestion[] } {
  const order = bandsFor(track);
  const byBand = groupByBand(bank);
  const stage1: PlacementQuestion[] = [];
  const used = new Set<string>();

  // Mid bands first for stage 1
  const midStart = Math.floor(order.length / 2) - 1;
  const stage1Bands = order.slice(Math.max(0, midStart), midStart + 3);
  for (const b of stage1Bands) {
    for (const q of take(byBand.get(b) || [], 2)) {
      if (!used.has(q.id)) {
        stage1.push(q);
        used.add(q.id);
      }
    }
  }
  // Pad with lower bands
  for (const b of order) {
    if (stage1.length >= 8) break;
    for (const q of byBand.get(b) || []) {
      if (stage1.length >= 8) break;
      if (!used.has(q.id) && !q.speak) {
        stage1.push(q);
        used.add(q.id);
      }
    }
  }

  const rest = bank.filter((q) => !used.has(q.id));
  const mid = Math.floor(order.length / 2);
  const stage2Easy: PlacementQuestion[] = [];
  const stage2Hard: PlacementQuestion[] = [];

  for (const q of rest) {
    const i = bandIndex(track, q.bandHint);
    if (i < mid) stage2Easy.push(q);
    else stage2Hard.push(q);
  }

  // Ensure listening items appear in stage 2 when present
  const listen = rest.filter((q) => q.speak || /listen/i.test(q.label));
  for (const q of listen) {
    if (!stage2Hard.includes(q) && !stage2Easy.includes(q)) stage2Hard.push(q);
  }

  return {
    stage1: stage1.length ? stage1 : bank.slice(0, 8),
    stage2Easy: stage2Easy.slice(0, 8),
    stage2Hard: stage2Hard.slice(0, 8),
  };
}

export function pickStage2(
  stage1Correct: number,
  stage1Total: number,
  easy: PlacementQuestion[],
  hard: PlacementQuestion[],
): PlacementQuestion[] {
  if (!easy.length && !hard.length) return [];
  const ratio = stage1Total ? stage1Correct / stage1Total : 0.5;
  if (ratio >= 0.65) return hard.length ? hard.slice(0, 6) : easy.slice(0, 6);
  if (ratio <= 0.4) return easy.length ? easy.slice(0, 6) : hard.slice(0, 6);
  return [...hard.slice(0, 3), ...easy.slice(0, 3)].slice(0, 6);
}

export function scorePlacement(
  track: TrackId,
  answered: { q: PlacementQuestion; correct: boolean }[],
): PlacementResult {
  const skills: SkillScores = {
    vocab: { correct: 0, total: 0 },
    grammar: { correct: 0, total: 0 },
    listening: { correct: 0, total: 0 },
    other: { correct: 0, total: 0 },
  };
  let correct = 0;
  for (const row of answered) {
    const sk = skillOf(row.q);
    skills[sk].total += 1;
    if (row.correct) {
      skills[sk].correct += 1;
      correct += 1;
    }
  }
  const total = answered.length || 1;
  const ratio = correct / total;

  let hintSum = 0;
  let hintN = 0;
  for (const row of answered) {
    const w = row.correct ? 1.2 : 0.4;
    hintSum += bandIndex(track, row.q.bandHint) * w;
    hintN += w;
  }
  const hintAvg = hintN ? hintSum / hintN : 0;
  let band = bandAt(track, Math.round(hintAvg));

  if (track === "jp") {
    if (ratio < 0.3) band = bandAt(track, Math.min(bandIndex(track, band), 0));
    else if (ratio < 0.45) band = bandAt(track, Math.min(bandIndex(track, band), 1));
    else if (ratio < 0.6) band = bandAt(track, Math.min(bandIndex(track, band), 2));
    else if (ratio < 0.8) band = bandAt(track, Math.min(Math.max(bandIndex(track, band), 2), 3));
  } else {
    if (ratio < 0.3) band = bandAt(track, Math.min(bandIndex(track, band), 0));
    else if (ratio < 0.45) band = bandAt(track, Math.min(bandIndex(track, band), 1));
    else if (ratio < 0.6) band = bandAt(track, Math.min(bandIndex(track, band), 2));
    else if (ratio < 0.75) band = bandAt(track, Math.min(Math.max(bandIndex(track, band), 2), 3));
    else if (ratio < 0.9) band = bandAt(track, Math.min(Math.max(bandIndex(track, band), 3), 4));
  }

  const weak: ("vocab" | "grammar" | "listening")[] = [];
  const strong: ("vocab" | "grammar" | "listening")[] = [];
  for (const key of ["vocab", "grammar", "listening"] as const) {
    if (skills[key].total < 2) continue;
    const r = skills[key].correct / skills[key].total;
    if (r < 0.45) weak.push(key);
    if (r >= 0.7) strong.push(key);
  }

  return { band, correct, total: answered.length, skills, weak, strong };
}

export function shiftBand(track: TrackId, band: string, delta: number): string {
  return bandAt(track, bandIndex(track, band) + delta);
}

export function goalsFromPlacement(
  track: TrackId,
  draft: Partial<PathGoals>,
  result: PlacementResult,
): PathGoals {
  const base = normalizePathGoals(draft);
  const skills = new Set(base.skills);
  if (result.weak.includes("grammar")) skills.add("grammar");
  if (result.weak.includes("vocab")) skills.add("vocab");
  if (result.weak.includes("listening")) skills.add("listening");
  if (track === "jp" && base.focus === "jlpt") skills.add("listening");
  if (track === "en" && base.focus === "exam_en") skills.add("listening");
  return normalizePathGoals({ ...base, skills: [...skills] });
}
