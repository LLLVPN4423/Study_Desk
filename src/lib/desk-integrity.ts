/**
 * Pure Desk / blob integrity helpers (Node-smoke friendly).
 * No IndexedDB or localStorage access. Keep free of relative imports so
 * `node --experimental-strip-types` can load this file directly.
 */

export const WALLPAP_CUSTOM_BLOB_KEY = "wallpaper:custom";

export function contentBlobKey(id: string) {
  return `content:${id}`;
}

export function annBlobKey(id: string) {
  return `ann:${id}`;
}

export function sourceBlobKey(id: string) {
  return `source:${id}`;
}

export function kindNeedsPrimaryBlob(kind: unknown): boolean {
  return kind === "pdf" || kind === "audio" || kind === "image" || kind === "doc";
}

export type IntegrityDeskFile = {
  id?: unknown;
  kind?: unknown;
  content?: unknown;
  pdfAnnotations?: unknown;
  dataUrl?: unknown;
  sourceDataUrl?: unknown;
};

export type IntegrityDesk = {
  files?: IntegrityDeskFile[];
  wallpaper?: unknown;
};

/** Keys a live desk may legitimately own in IndexedDB (conservative). */
export function referencedBlobKeysFromDesk(desk: IntegrityDesk): Set<string> {
  const keys = new Set<string>();
  const files = Array.isArray(desk.files) ? desk.files : [];
  for (const f of files) {
    if (typeof f?.id !== "string" || !f.id) continue;
    keys.add(f.id);
    keys.add(sourceBlobKey(f.id));
    keys.add(contentBlobKey(f.id));
    keys.add(annBlobKey(f.id));
  }
  if (desk.wallpaper === "custom") {
    keys.add(WALLPAP_CUSTOM_BLOB_KEY);
  }
  return keys;
}

/** Required primary blob keys for binary kinds (export/restore gate). */
export function requiredPrimaryKeysFromDesk(desk: IntegrityDesk): string[] {
  const out: string[] = [];
  const files = Array.isArray(desk.files) ? desk.files : [];
  for (const f of files) {
    if (typeof f?.id === "string" && f.id && kindNeedsPrimaryBlob(f.kind)) {
      out.push(f.id);
    }
  }
  return out;
}

export function findMissingRequiredPrimaryBlobs(
  desk: IntegrityDesk,
  blobs: Record<string, string>,
): string[] {
  return requiredPrimaryKeysFromDesk(desk).filter(
    (k) => typeof blobs[k] !== "string" || !blobs[k],
  );
}

/** Keys present in storage but not claimed by desk metadata. Safe GC candidates. */
export function findOrphanBlobKeys(
  existingKeys: Iterable<string>,
  referenced: Set<string>,
): string[] {
  const orphans: string[] = [];
  for (const key of existingKeys) {
    if (!referenced.has(key)) orphans.push(key);
  }
  orphans.sort();
  return orphans;
}

/**
 * Plan GC: only keys proven unreferenced by desk metadata.
 * Never includes keys still owned by any file id / side key / custom wallpaper.
 */
export function planOrphanGc(
  existingKeys: Iterable<string>,
  desk: IntegrityDesk,
): string[] {
  return findOrphanBlobKeys(existingKeys, referencedBlobKeysFromDesk(desk));
}

/** Referenced keys with no non-empty blob string. */
export function findMissingReferencedBlobs(
  referenced: Set<string>,
  blobs: Record<string, string>,
  opts?: { onlyRequiredPrimary?: boolean; desk?: IntegrityDesk },
): string[] {
  if (opts?.onlyRequiredPrimary && opts.desk) {
    return findMissingRequiredPrimaryBlobs(opts.desk, blobs);
  }
  const missing: string[] = [];
  for (const key of referenced) {
    if (typeof blobs[key] !== "string" || !blobs[key]) missing.push(key);
  }
  missing.sort();
  return missing;
}

export type RestoreBlobClassify = {
  /** Keys in the incoming backup. */
  incomingKeys: string[];
  /** Keys that already existed before restore (will be overwritten). */
  overwriteKeys: string[];
  /** Keys that did not exist before restore (novel). */
  novelKeys: string[];
};

/** Classify incoming restore keys vs previous IDB key set. */
export function classifyRestoreBlobKeys(
  incomingKeys: Iterable<string>,
  previousKeys: Iterable<string>,
): RestoreBlobClassify {
  const prev = new Set(previousKeys);
  const incoming = [...new Set(incomingKeys)];
  const overwriteKeys: string[] = [];
  const novelKeys: string[] = [];
  for (const k of incoming) {
    if (prev.has(k)) overwriteKeys.push(k);
    else novelKeys.push(k);
  }
  overwriteKeys.sort();
  novelKeys.sort();
  incoming.sort();
  return { incomingKeys: incoming, overwriteKeys, novelKeys };
}

export type RestoreBlobRollbackPlan = {
  /** Re-put previous values for keys that were overwritten. */
  restorePuts: Record<string, string>;
  /** Delete keys that were newly written and did not exist before. */
  deleteKeys: string[];
};

/**
 * After a failed restore write: restore overwritten values; delete only novel keys
 * that were successfully written. Never deletes pre-existing keys.
 */
export function planRestoreBlobRollback(input: {
  /** Keys successfully written during the failed restore. */
  writtenKeys: Iterable<string>;
  /** Snapshot of previous values for keys that existed before (may be subset). */
  previousSnapshots: Record<string, string>;
  /** Keys that did not exist before restore. */
  novelKeys: Iterable<string>;
}): RestoreBlobRollbackPlan {
  const written = new Set(input.writtenKeys);
  const novel = new Set(input.novelKeys);
  const restorePuts: Record<string, string> = {};
  const deleteKeys: string[] = [];

  for (const key of written) {
    if (novel.has(key)) {
      deleteKeys.push(key);
      continue;
    }
    const prev = input.previousSnapshots[key];
    if (typeof prev === "string") {
      restorePuts[key] = prev;
    }
  }
  deleteKeys.sort();
  return { restorePuts, deleteKeys };
}

export type ProvenanceIntegrityIssue = {
  sourceId: string;
  issue: "file_missing" | "missing_file_id";
};

/** Soft RI: desk-origin cards whose sourceFileId is missing or not in desk. */
export function findBrokenDeskProvenance(
  cards: Array<{
    sourceId?: string;
    origin?: string;
    sourceFileId?: string;
  }>,
  fileIds: Iterable<string>,
): ProvenanceIntegrityIssue[] {
  const files = new Set(fileIds);
  const out: ProvenanceIntegrityIssue[] = [];
  for (const c of cards) {
    if (!c.sourceId) continue;
    const origin = c.origin;
    const fid = typeof c.sourceFileId === "string" ? c.sourceFileId.trim() : "";
    if (origin === "desk" || fid) {
      if (!fid) {
        if (origin === "desk") {
          out.push({ sourceId: c.sourceId, issue: "missing_file_id" });
        }
        continue;
      }
      if (!files.has(fid)) {
        out.push({ sourceId: c.sourceId, issue: "file_missing" });
      }
    }
  }
  return out;
}
