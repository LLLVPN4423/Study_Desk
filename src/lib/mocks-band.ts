import bandMocks from "@/data/mocks-by-band.json";
import mockJp from "@/data/mocks-jp.json";
import mockEn from "@/data/mocks-en.json";
import listenJp from "@/data/mocks-listening-jp.json";
import listenEn from "@/data/mocks-listening-en.json";

export type TrackId = "jp" | "en";

export type MockQ = {
  id: string;
  prompt: string;
  choices: string[];
  answer: number;
  speak?: string;
};

export type MockPack = {
  id: string;
  title: string;
  track: string;
  band?: string;
  minutes: number;
  disclaimer: string;
  mode?: string;
  questions: MockQ[];
};

const JP_ORDER = ["N5", "N4", "N3", "N2", "N1"] as const;
const EN_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

type PackFile = { packs: MockPack[] };

function fallback(
  track: TrackId,
  mode: "vocab" | "listening",
): MockPack {
  if (mode === "listening") {
    return (track === "jp" ? listenJp : listenEn) as MockPack;
  }
  return (track === "jp" ? mockJp : mockEn) as MockPack;
}

function nearestBand(track: TrackId, band: string | null | undefined): string | null {
  if (!band) return null;
  const order = track === "jp" ? JP_ORDER : EN_ORDER;
  if ((order as readonly string[]).includes(band)) return band;
  return order[0];
}

/** Resolve mock pack for track/mode/band (path band or query). */
export function resolveMockPack(
  track: TrackId,
  mode: "vocab" | "listening",
  band: string | null | undefined,
): MockPack {
  const packs = (bandMocks as PackFile).packs || [];
  const want = nearestBand(track, band);
  if (want) {
    const hit = packs.find(
      (p) => p.track === track && p.mode === mode && p.band === want && p.questions?.length,
    );
    if (hit) return hit;
  }
  // Any pack for track+mode
  const any = packs.find((p) => p.track === track && p.mode === mode && p.questions?.length);
  if (any) return any;
  return fallback(track, mode);
}

export function bandsForTrack(track: TrackId): readonly string[] {
  return track === "jp" ? JP_ORDER : EN_ORDER;
}
