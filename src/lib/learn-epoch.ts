/**
 * Pure helpers for Learn pathsEpoch migration (Node-smoke friendly).
 * Avoid silent wipe of cards/progress when epoch bumps after backup restore.
 */

export type EpochLearnProbe = {
  pathsEpoch?: number;
  preferredTrack?: string;
  jp?: { cards?: unknown[]; pathActive?: boolean; roadmap?: unknown | null };
  en?: { cards?: unknown[]; pathActive?: boolean; roadmap?: unknown | null };
};

/** True when the payload has user learning data worth preserving across epoch bumps. */
export function shouldPreserveLearnOnEpochMismatch(parsed: EpochLearnProbe): boolean {
  const jpCards = Array.isArray(parsed.jp?.cards) ? parsed.jp.cards.length : 0;
  const enCards = Array.isArray(parsed.en?.cards) ? parsed.en.cards.length : 0;
  if (jpCards + enCards > 0) return true;
  if (parsed.jp?.pathActive || parsed.en?.pathActive) return true;
  if (parsed.jp?.roadmap || parsed.en?.roadmap) return true;
  return false;
}

export function epochMismatchWarning(
  backupEpoch: number | undefined,
  currentEpoch: number,
): string | undefined {
  if (backupEpoch === currentEpoch) return undefined;
  const shown = backupEpoch == null ? "thiếu" : String(backupEpoch);
  return `pathsEpoch bản sao (${shown}) khác phiên bản app (${currentEpoch}) — đã giữ thẻ/tiến độ và nâng epoch, không xóa học liệu.`;
}

/**
 * Mirrors backup `learnForRestore`: bump epoch on import so the next loadLearn
 * does not treat the payload as a wipe candidate. Pure — no I/O.
 */
export function prepareLearnForRestore<T extends EpochLearnProbe>(
  learn: T,
  currentEpoch: number,
): { learn: T & { pathsEpoch: number }; epochNote?: string } {
  const backupEpoch = learn.pathsEpoch;
  return {
    learn: { ...learn, pathsEpoch: currentEpoch },
    epochNote: epochMismatchWarning(backupEpoch, currentEpoch),
  };
}

export type EpochGateDecision =
  | { action: "unchanged" }
  | { action: "preserve"; preferredTrack: "jp" | "en" }
  | { action: "seed-beginner"; preferredTrack: "jp" | "en" };

/** Mirrors loadLearn epoch branch without touching localStorage. */
export function decideEpochGate(
  parsed: EpochLearnProbe,
  currentEpoch: number,
): EpochGateDecision {
  const preferred =
    parsed.preferredTrack === "en" || parsed.preferredTrack === "jp"
      ? parsed.preferredTrack
      : "jp";
  if (parsed.pathsEpoch === currentEpoch) return { action: "unchanged" };
  if (shouldPreserveLearnOnEpochMismatch(parsed)) {
    return { action: "preserve", preferredTrack: preferred };
  }
  return { action: "seed-beginner", preferredTrack: preferred };
}
