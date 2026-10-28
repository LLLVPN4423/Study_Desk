/**
 * Pure backup payload helpers (no IndexedDB / localStorage).
 * Used by backup.ts and Node smoke tests.
 */

export const BACKUP_VERSION_LEGACY = 1 as const;
export const BACKUP_VERSION_CURRENT = 2 as const;

export type BackupBlobRole =
  | "primary"
  | "source"
  | "content"
  | "annotations"
  | "wallpaper";

/** Optional per-key metadata for restore UX / validation. */
export type BackupBlobMeta = {
  role?: BackupBlobRole;
  mime?: string;
  originalName?: string;
  size?: number;
  fileId?: string;
};

export type BackupPayloadV1 = {
  version: 1;
  exportedAt: string;
  session: unknown;
  desk: { files?: unknown[]; [key: string]: unknown };
  learn: unknown;
  theme?: string;
};

export type BackupPayloadV2 = {
  version: 2;
  exportedAt: string;
  session: unknown;
  desk: { files?: unknown[]; wallpaper?: string; [key: string]: unknown };
  learn: unknown;
  theme?: string;
  /**
   * IndexedDB `study-desk-blobs` entries keyed as stored (file id, `source:…`,
   * `content:…`, `ann:…`, `wallpaper:custom`). Values are data-URL or text
   * strings — same representation as the live IDB store (base64 in JSON).
   */
  deskBlobs: Record<string, string>;
  blobMeta?: Record<string, BackupBlobMeta>;
};

export type BackupPayload = BackupPayloadV1 | BackupPayloadV2;

export type BackupValidationError = {
  code:
    | "parse"
    | "shape"
    | "version"
    | "duplicate_ids"
    | "missing_blobs"
    | "invalid_blob"
    | "empty";
  message: string;
};

export function contentBlobKey(id: string) {
  return `content:${id}`;
}

export function annBlobKey(id: string) {
  return `ann:${id}`;
}

export function sourceBlobKey(id: string) {
  return `source:${id}`;
}

export const WALLPAP_CUSTOM_BLOB_KEY = "wallpaper:custom";

export function mimeFromDataUrl(dataUrl: string): string | undefined {
  const m = /^data:([^;,]+)/i.exec(dataUrl);
  return m?.[1];
}

export function approxByteSizeOfStored(data: string): number {
  if (data.startsWith("data:") && data.includes(",")) {
    const b64 = data.slice(data.indexOf(",") + 1);
    return Math.floor((b64.length * 3) / 4);
  }
  return new TextEncoder().encode(data).length;
}

type DeskFileLike = {
  id?: unknown;
  name?: unknown;
  kind?: unknown;
  size?: unknown;
  dataUrl?: unknown;
  sourceDataUrl?: unknown;
  content?: unknown;
  pdfAnnotations?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function parseBackupJson(raw: string): { ok: true; data: unknown } | { ok: false; error: BackupValidationError } {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: { code: "empty", message: "Backup file is empty." } };
  }
  try {
    return { ok: true, data: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, error: { code: "parse", message: "Backup is not valid JSON." } };
  }
}

/** Validate shape; does not touch storage. */
export function validateBackupPayload(
  data: unknown,
): { ok: true; payload: BackupPayload } | { ok: false; error: BackupValidationError } {
  if (!isRecord(data)) {
    return { ok: false, error: { code: "shape", message: "Backup root must be an object." } };
  }
  const version = data.version;
  if (version !== 1 && version !== 2) {
    return {
      ok: false,
      error: {
        code: "version",
        message: `Unsupported backup version (${String(version)}).`,
      },
    };
  }
  if (!isRecord(data.desk) || data.learn === undefined || data.learn === null) {
    return {
      ok: false,
      error: { code: "shape", message: "Backup must include desk and learn." },
    };
  }
  const files = data.desk.files;
  if (files !== undefined && !Array.isArray(files)) {
    return { ok: false, error: { code: "shape", message: "desk.files must be an array." } };
  }
  const ids = new Set<string>();
  for (const f of (files as DeskFileLike[]) || []) {
    if (!f || typeof f !== "object") {
      return { ok: false, error: { code: "shape", message: "Invalid desk file entry." } };
    }
    if (typeof f.id !== "string" || !f.id) {
      return { ok: false, error: { code: "shape", message: "Each desk file needs a string id." } };
    }
    if (ids.has(f.id)) {
      return {
        ok: false,
        error: { code: "duplicate_ids", message: `Duplicate file id in backup: ${f.id}` },
      };
    }
    ids.add(f.id);
  }

  if (version === 1) {
    return {
      ok: true,
      payload: {
        version: 1,
        exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "",
        session: data.session ?? null,
        desk: data.desk as BackupPayloadV1["desk"],
        learn: data.learn,
        theme: typeof data.theme === "string" ? data.theme : undefined,
      },
    };
  }

  const deskBlobs = data.deskBlobs;
  if (!isRecord(deskBlobs)) {
    return {
      ok: false,
      error: {
        code: "shape",
        message: "Backup v2 must include deskBlobs object (file binary map).",
      },
    };
  }
  for (const [key, value] of Object.entries(deskBlobs)) {
    if (typeof key !== "string" || !key) {
      return { ok: false, error: { code: "invalid_blob", message: "Invalid deskBlobs key." } };
    }
    if (typeof value !== "string" || value.length === 0) {
      return {
        ok: false,
        error: {
          code: "invalid_blob",
          message: `deskBlobs[${key}] must be a non-empty string.`,
        },
      };
    }
  }

  const blobMeta = data.blobMeta;
  if (blobMeta !== undefined && !isRecord(blobMeta)) {
    return { ok: false, error: { code: "shape", message: "blobMeta must be an object." } };
  }

  return {
    ok: true,
    payload: {
      version: 2,
      exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "",
      session: data.session ?? null,
      desk: data.desk as BackupPayloadV2["desk"],
      learn: data.learn,
      theme: typeof data.theme === "string" ? data.theme : undefined,
      deskBlobs: deskBlobs as Record<string, string>,
      blobMeta: blobMeta as Record<string, BackupBlobMeta> | undefined,
    },
  };
}

/** Kinds that must have a primary blob to open after restore. */
export function kindNeedsPrimaryBlob(kind: unknown): boolean {
  return kind === "pdf" || kind === "audio" || kind === "image" || kind === "doc";
}

/**
 * Required IDB keys for a v2 restore to open binary files.
 * Notes may live only in desk.files[].content.
 */
export function requiredPrimaryBlobKeys(desk: { files?: unknown }): string[] {
  const keys: string[] = [];
  const files = Array.isArray(desk.files) ? desk.files : [];
  for (const raw of files) {
    const f = raw as DeskFileLike;
    if (typeof f?.id === "string" && kindNeedsPrimaryBlob(f.kind)) {
      keys.push(f.id);
    }
  }
  return keys;
}

export function findMissingRequiredBlobs(
  desk: { files?: unknown },
  deskBlobs: Record<string, string>,
): string[] {
  return requiredPrimaryBlobKeys(desk).filter((k) => typeof deskBlobs[k] !== "string" || !deskBlobs[k]);
}

/** Strip bulky inlines from desk metadata before embedding in JSON (blobs live in deskBlobs). */
export function stripDeskInlineBlobs<T extends { files: DeskFileLike[] }>(desk: T): T {
  return {
    ...desk,
    files: desk.files.map((f) => {
      const rest = { ...(f as DeskFileLike & Record<string, unknown>) };
      delete rest.dataUrl;
      delete rest.sourceDataUrl;
      return rest as DeskFileLike;
    }),
  };
}

export function buildBlobMetaFromFiles(
  files: DeskFileLike[],
  deskBlobs: Record<string, string>,
): Record<string, BackupBlobMeta> {
  const meta: Record<string, BackupBlobMeta> = {};
  for (const f of files) {
    if (typeof f.id !== "string") continue;
    const name = typeof f.name === "string" ? f.name : undefined;
    const size = typeof f.size === "number" ? f.size : undefined;
    const id = f.id;
    if (deskBlobs[id]) {
      meta[id] = {
        role: "primary",
        fileId: id,
        originalName: name,
        size: size ?? approxByteSizeOfStored(deskBlobs[id]),
        mime: mimeFromDataUrl(deskBlobs[id]),
      };
    }
    const sk = sourceBlobKey(id);
    if (deskBlobs[sk]) {
      meta[sk] = {
        role: "source",
        fileId: id,
        originalName: name,
        mime: mimeFromDataUrl(deskBlobs[sk]),
        size: approxByteSizeOfStored(deskBlobs[sk]),
      };
    }
    const ck = contentBlobKey(id);
    if (deskBlobs[ck]) {
      meta[ck] = { role: "content", fileId: id, originalName: name };
    }
    const ak = annBlobKey(id);
    if (deskBlobs[ak]) {
      meta[ak] = { role: "annotations", fileId: id, originalName: name };
    }
  }
  if (deskBlobs[WALLPAP_CUSTOM_BLOB_KEY]) {
    meta[WALLPAP_CUSTOM_BLOB_KEY] = {
      role: "wallpaper",
      mime: mimeFromDataUrl(deskBlobs[WALLPAP_CUSTOM_BLOB_KEY]),
      size: approxByteSizeOfStored(deskBlobs[WALLPAP_CUSTOM_BLOB_KEY]),
    };
  }
  return meta;
}
