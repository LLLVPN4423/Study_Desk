/**
 * Slice 2B–2D helpers: optional flashcard provenance (pure; Node-smoke friendly).
 *
 * Anchors are quote-based (and optional PDF page). Exact TipTap/PDF character
 * offsets are intentionally not required — editors reflow and PDF text layers vary.
 */

export type SourceAnchorKind = "selection" | "notes" | "pdf-quote" | "pdf-page";

export type SourceAnchor = {
  kind: SourceAnchorKind;
  /** Short excerpt used for display and best-effort re-find in the source. */
  quote?: string;
  /** 1-based PDF page when known; omitted when unknown. */
  page?: number;
};

export type CardProvenance = {
  origin?: "curriculum" | "manual" | "desk";
  sourceFileId?: string;
  sourceAnchor?: SourceAnchor;
};

const QUOTE_MAX = 280;

export function normalizeQuote(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  return t.length > QUOTE_MAX ? `${t.slice(0, QUOTE_MAX)}…` : t;
}

export function normalizeSourceAnchor(raw: unknown): SourceAnchor | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (
    kind !== "selection" &&
    kind !== "notes" &&
    kind !== "pdf-quote" &&
    kind !== "pdf-page"
  ) {
    return undefined;
  }
  const quote = normalizeQuote(o.quote);
  const page =
    typeof o.page === "number" && Number.isFinite(o.page) && o.page >= 1
      ? Math.floor(o.page)
      : undefined;
  if (!quote && page === undefined) return undefined;
  return { kind, quote, page };
}

export function pickProvenanceFields(
  card: CardProvenance,
): CardProvenance {
  const out: CardProvenance = {};
  if (card.origin === "curriculum" || card.origin === "manual" || card.origin === "desk") {
    out.origin = card.origin;
  }
  if (typeof card.sourceFileId === "string" && card.sourceFileId.trim()) {
    out.sourceFileId = card.sourceFileId.trim();
  }
  const anchor = normalizeSourceAnchor(card.sourceAnchor);
  if (anchor) out.sourceAnchor = anchor;
  return out;
}

/** Same track + normalized word + same sourceFileId (both missing counts as same). */
export function isDuplicateDeskCard(
  existing: Array<{ sourceId?: string; word?: string; sourceFileId?: string }>,
  word: string,
  sourceFileId?: string,
): boolean {
  const w = word.trim().toLowerCase();
  if (!w) return false;
  const fid = sourceFileId?.trim() || undefined;
  return existing.some((c) => {
    if (!c.sourceId || !String(c.sourceId).startsWith("manual-")) return false;
    if ((c.word || "").trim().toLowerCase() !== w) return false;
    const other = c.sourceFileId?.trim() || undefined;
    return other === fid;
  });
}

export type DeskFileRef = { id: string; name?: string };

export type ResolveSourceResult =
  | {
      ok: true;
      href: string;
      fileId: string;
      fileName: string;
      quote?: string;
      page?: number;
    }
  | {
      ok: false;
      reason: "missing_provenance" | "file_missing";
      message: string;
      quote?: string;
    };

/** Build /desk?open=…&highlight=… when provenance is resolvable. */
export function resolveCardSourceLink(
  card: CardProvenance,
  files: DeskFileRef[],
): ResolveSourceResult {
  const fileId = card.sourceFileId?.trim();
  const anchor = normalizeSourceAnchor(card.sourceAnchor);
  const quote = anchor?.quote;
  if (!fileId) {
    return {
      ok: false,
      reason: "missing_provenance",
      message: "Thẻ này không gắn tài liệu nguồn.",
      quote,
    };
  }
  const file = files.find((f) => f.id === fileId);
  if (!file) {
    return {
      ok: false,
      reason: "file_missing",
      message: quote
        ? `Tài liệu nguồn đã xóa hoặc không còn trên bàn. Trích dẫn: “${quote}”`
        : "Tài liệu nguồn đã xóa hoặc không còn trên bàn.",
      quote,
    };
  }
  const params = new URLSearchParams();
  params.set("open", fileId);
  if (quote) params.set("highlight", quote.slice(0, 120));
  if (anchor?.page) params.set("page", String(anchor.page));
  return {
    ok: true,
    href: `/desk?${params.toString()}`,
    fileId,
    fileName: file.name || fileId,
    quote,
    page: anchor?.page,
  };
}
