/**
 * Band-scoped vocab seed loaders — dynamic import so Desk / unused bands
 * stay out of the initial JS chunk (same build for local + deploy).
 */
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

export const JP_BANDS = ["N5", "N4", "N3", "N2", "N1"] as const;
export const EN_BANDS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type JpBand = (typeof JP_BANDS)[number];
export type EnBand = (typeof EN_BANDS)[number];

const jpLoaders: Record<JpBand, () => Promise<{ default: VocabSeed[] }>> = {
  N5: () => import("@/data/openjlpt-n5-seed.json"),
  N4: () => import("@/data/openjlpt-n4-seed.json"),
  N3: () => import("@/data/openjlpt-n3-seed.json"),
  N2: () => import("@/data/openjlpt-n2-seed.json"),
  N1: () => import("@/data/openjlpt-n1-seed.json"),
};

const jpCache = new Map<JpBand, VocabSeed[]>();
const jpPending = new Map<JpBand, Promise<void>>();

let enAll: VocabSeed[] | null = null;
let enPending: Promise<void> | null = null;
const enBandCache = new Map<string, VocabSeed[]>();

/** Bumped when any band loads — learn-store seed indexes must rebuild. */
let seedGeneration = 0;

export function getSeedGeneration(): number {
  return seedGeneration;
}

function bumpGeneration() {
  seedGeneration += 1;
}

export function normalizeJpBand(band: string): JpBand {
  const u = band.toUpperCase();
  if ((JP_BANDS as readonly string[]).includes(u)) return u as JpBand;
  return "N5";
}

export function normalizeEnBand(band: string): EnBand {
  const u = band.toUpperCase();
  if ((EN_BANDS as readonly string[]).includes(u)) return u as EnBand;
  return "A1";
}

export function isJpBandLoaded(band: string): boolean {
  return jpCache.has(normalizeJpBand(band));
}

export function isEnVocabLoaded(): boolean {
  return enAll !== null;
}

export async function ensureVocabBand(track: TrackId, band: string): Promise<void> {
  if (track === "jp") {
    const key = normalizeJpBand(band);
    if (jpCache.has(key)) return;
    let p = jpPending.get(key);
    if (!p) {
      p = (async () => {
        const mod = await jpLoaders[key]();
        jpCache.set(key, mod.default as VocabSeed[]);
        bumpGeneration();
        jpPending.delete(key);
      })();
      jpPending.set(key, p);
    }
    await p;
    return;
  }

  if (!enAll) {
    if (!enPending) {
      enPending = (async () => {
        const mod = await import("@/data/cefrj-vocab-seed.json");
        enAll = mod.default as VocabSeed[];
        bumpGeneration();
        enPending = null;
      })();
    }
    await enPending;
  }
  const primary = normalizeEnBand(band);
  if (!enBandCache.has(primary) && enAll) {
    enBandCache.set(
      primary,
      enAll.filter((w) => String(w.level || "").toUpperCase() === primary),
    );
  }
}

/** Load every band for a track (vocab catalog / search). */
export async function ensureAllVocab(track: TrackId): Promise<void> {
  if (track === "jp") {
    await Promise.all(JP_BANDS.map((b) => ensureVocabBand("jp", b)));
    return;
  }
  await ensureVocabBand("en", "A1");
  for (const b of EN_BANDS) {
    await ensureVocabBand("en", b);
  }
}

export function getVocabBand(track: TrackId, band: string): VocabSeed[] {
  if (track === "jp") {
    return jpCache.get(normalizeJpBand(band)) || [];
  }
  const primary = normalizeEnBand(band);
  return enBandCache.get(primary) || [];
}

export function getJpSeed(): VocabSeed[] {
  const out: VocabSeed[] = [];
  for (const b of JP_BANDS) {
    const chunk = jpCache.get(b);
    if (chunk) out.push(...chunk);
  }
  return out;
}

/** Raw EN rows already loaded (uncleaned). */
export function getEnSeedRaw(): VocabSeed[] {
  return enAll ? [...enAll] : [];
}

export function getLoadedEnByLevel(level: string): VocabSeed[] {
  return getVocabBand("en", level);
}
