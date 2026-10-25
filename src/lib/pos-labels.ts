/** Normalize OpenJLPT / CEFR-J POS codes into filter buckets + VI labels. */

export type PosBucket =
  | "noun"
  | "verb"
  | "adj"
  | "adv"
  | "particle"
  | "expression"
  | "other";

const BUCKET_VI: Record<PosBucket, string> = {
  noun: "Danh từ",
  verb: "Động từ",
  adj: "Tính từ",
  adv: "Trạng từ",
  particle: "Trợ từ",
  expression: "Cụm / biểu thức",
  other: "Khác",
};

export function posBucketLabel(bucket: PosBucket | "all") {
  if (bucket === "all") return "Tất cả loại từ";
  return BUCKET_VI[bucket];
}

export function bucketFromPos(pos?: string | string[] | null): PosBucket {
  const raw = (Array.isArray(pos) ? pos.join(",") : pos || "").toLowerCase();
  if (!raw) return "other";
  if (/(^|,)(n|noun|n-|pn)(,|$)/.test(raw) || raw.includes("noun")) return "noun";
  if (raw.includes("verb") || /(^|,)v[0-9]/.test(raw) || raw.includes("vt") || raw.includes("vi"))
    return "verb";
  if (raw.includes("adj") || raw.includes("adjective")) return "adj";
  if (raw.includes("adv") || raw.includes("adverb")) return "adv";
  if (raw.includes("prt") || raw.includes("particle") || raw.includes("aux")) return "particle";
  if (raw.includes("exp") || raw.includes("expression") || raw.includes("phrase"))
    return "expression";
  if (
    raw.includes("determiner") ||
    raw.includes("preposition") ||
    raw.includes("pronoun") ||
    raw.includes("conjunction") ||
    raw.includes("article") ||
    raw.includes("interjection") ||
    raw.includes("number")
  ) {
    // map EN grammar POS into coarse buckets for filters
    if (raw.includes("noun")) return "noun";
    if (raw.includes("verb")) return "verb";
    if (raw.includes("adj")) return "adj";
    if (raw.includes("adv")) return "adv";
    if (raw.includes("preposition") || raw.includes("conjunction") || raw.includes("determiner"))
      return "particle";
    return "other";
  }
  return "other";
}

export function formatPosDisplay(pos?: string | string[] | null): string {
  if (!pos) return "";
  const raw = Array.isArray(pos) ? pos.join(", ") : pos;
  return raw;
}

export const POS_BUCKETS: PosBucket[] = [
  "noun",
  "verb",
  "adj",
  "adv",
  "particle",
  "expression",
  "other",
];
