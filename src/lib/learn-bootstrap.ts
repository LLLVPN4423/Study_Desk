/**
 * Prefetch vocab bands + VI gloss before Learn UI hydrates cards / builds paths.
 */
import { ensureGlossTrack, ensureKanjiGloss } from "./gloss-vi";
import { getTrack, readLearn, type TrackId } from "./learn-store-core";
import { STORAGE_KEYS } from "./storage-keys";
import {
  ensureAllVocab,
  ensureVocabBand,
  type TrackId as SeedTrack,
} from "./vocab-seeds";

export type LearnBootstrapMode = "path" | "catalog";

function jpBandsFor(band: string): string[] {
  if (band === "N5") return ["N5"];
  if (band === "N4") return ["N4", "N5"];
  if (band === "N3") return ["N3", "N4"];
  if (band === "N2") return ["N2", "N3"];
  return ["N1", "N2"];
}

function bandsForTrack(track: TrackId, band: string | null): string[] {
  if (track === "jp") return jpBandsFor(band || "N5");
  return [band || "A1"];
}

/**
 * Load seeds + gloss for the active Learn context.
 * - path: preferred track (+ beginner bands if empty storage)
 * - catalog: full track vocab (dictionary / vocab browser)
 */
export async function bootstrapLearn(
  mode: LearnBootstrapMode = "path",
  opts?: { track?: TrackId },
): Promise<void> {
  const state = readLearn();
  const track: TrackId = opts?.track || state.preferredTrack || "jp";
  const t = getTrack(state, track);

  const rawEmpty =
    typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEYS.learn);

  if (rawEmpty || (!t.pathActive && !state.jp.pathActive && !state.en.pathActive)) {
    await Promise.all([
      ensureVocabBand("jp", "N5"),
      ensureVocabBand("en", "A1"),
      ensureGlossTrack("jp"),
      ensureGlossTrack("en"),
    ]);
    return;
  }

  if (mode === "catalog") {
    await Promise.all([
      ensureAllVocab(track as SeedTrack),
      ensureGlossTrack(track),
      track === "jp" ? ensureKanjiGloss() : Promise.resolve(),
    ]);
    return;
  }

  const bands = bandsForTrack(track, t.band);
  const other: TrackId = track === "jp" ? "en" : "jp";
  const otherT = getTrack(state, other);
  const tasks: Promise<void>[] = [
    ...bands.map((b) => ensureVocabBand(track as SeedTrack, b)),
    ensureGlossTrack(track),
  ];
  if (otherT.pathActive && otherT.band) {
    for (const b of bandsForTrack(other, otherT.band)) {
      tasks.push(ensureVocabBand(other as SeedTrack, b));
    }
    tasks.push(ensureGlossTrack(other));
  }
  if (track === "jp") {
    tasks.push(ensureKanjiGloss());
  }
  await Promise.all(tasks);
}
