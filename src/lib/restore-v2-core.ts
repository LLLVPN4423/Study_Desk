/**
 * V2 restore orchestration with injectable storage/blob deps.
 * Pure of IndexedDB / localStorage globals so Node smokes can use an in-memory store.
 * Keep free of relative imports (Node --experimental-strip-types resolution).
 */

function classifyRestoreBlobKeys(
  incomingKeys: Iterable<string>,
  previousKeys: Iterable<string>,
): { overwriteKeys: string[]; novelKeys: string[] } {
  const prev = new Set(previousKeys);
  const overwriteKeys: string[] = [];
  const novelKeys: string[] = [];
  for (const k of [...new Set(incomingKeys)]) {
    if (prev.has(k)) overwriteKeys.push(k);
    else novelKeys.push(k);
  }
  overwriteKeys.sort();
  novelKeys.sort();
  return { overwriteKeys, novelKeys };
}

function planRestoreBlobRollback(input: {
  writtenKeys: Iterable<string>;
  previousSnapshots: Record<string, string>;
  novelKeys: Iterable<string>;
}): { restorePuts: Record<string, string>; deleteKeys: string[] } {
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
    if (typeof prev === "string") restorePuts[key] = prev;
  }
  deleteKeys.sort();
  return { restorePuts, deleteKeys };
}

export type RestoreV2Result = {
  ok: boolean;
  version: 2;
  message: string;
  blobsWritten?: number;
  blobsFailed?: string[];
  missingRequired?: string[];
  legacyWarning?: string;
  /** True when LS was rolled back but IndexedDB rollback did not fully succeed. */
  recoveryIncomplete?: boolean;
};

export type BlobPutResult = {
  written: number;
  writtenKeys: string[];
  failed: string[];
};

export type RestoreV2BlobStore = {
  listKeys: () => Promise<string[]>;
  getByKeys: (
    keys: string[],
  ) => Promise<{ blobs: Record<string, string>; missing: string[] }>;
  putBlobs: (blobs: Record<string, string>) => Promise<BlobPutResult>;
  deleteBlobs: (
    ids: string[],
  ) => Promise<{ deleted: string[]; failed: string[] }>;
};

export type RestoreV2LocalStore = {
  /** Snapshot desk/learn/session/theme (opaque to this module). */
  snapshot: () => unknown;
  /** Restore opaque snapshot. */
  restoreSnapshot: (snap: unknown) => void;
  /** Persist desk metadata only (no blob puts). */
  saveDeskMetadata: (desk: unknown) => { ok: boolean; reason?: string };
  saveLearn: (learn: unknown) => void;
  saveSession?: (session: unknown) => void;
  setTheme?: (theme: string) => void;
  /**
   * Prepare learn for restore (epoch bump). Returns learn to save + optional note.
   */
  prepareLearn: (learn: unknown) => { learn: unknown; epochNote?: string };
  /**
   * Optional post-success GC. Must not run on failure paths.
   * Tests should assert this is not called when restore fails.
   */
  gcOrphans?: (desk: unknown) => void | Promise<void>;
};

export type RestoreV2Input = {
  desk: unknown;
  learn: unknown;
  session?: unknown;
  theme?: string;
  deskBlobs: Record<string, string>;
  findMissingRequired: (desk: unknown, blobs: Record<string, string>) => string[];
  deskForLocalStorage: (desk: unknown, blobs: Record<string, string>) => unknown;
};

async function rollbackFailedRestoreBlobs(
  store: RestoreV2BlobStore,
  input: {
    writtenKeys: string[];
    previousSnapshots: Record<string, string>;
    novelKeys: string[];
  },
): Promise<{ ok: boolean; detail?: string }> {
  const plan = planRestoreBlobRollback(input);
  if (Object.keys(plan.restorePuts).length) {
    const put = await store.putBlobs(plan.restorePuts);
    if (put.failed.length) {
      return {
        ok: false,
        detail: `Không hoàn tác được ${put.failed.length} blob đã ghi đè.`,
      };
    }
  }
  if (plan.deleteKeys.length) {
    try {
      const del = await store.deleteBlobs(plan.deleteKeys);
      if (del.failed.length) {
        return {
          ok: false,
          detail: "Không xóa được blob mới ghi trong lần khôi phục thất bại.",
        };
      }
    } catch {
      return {
        ok: false,
        detail: "Không xóa được blob mới ghi trong lần khôi phục thất bại.",
      };
    }
  }
  return { ok: true };
}

/**
 * Execute backup v2 restore with injected blob + local stores.
 */
export async function restoreBackupV2Core(
  input: RestoreV2Input,
  blobs: RestoreV2BlobStore,
  local: RestoreV2LocalStore,
): Promise<RestoreV2Result> {
  const missingRequired = input.findMissingRequired(input.desk, input.deskBlobs);
  if (missingRequired.length) {
    return {
      ok: false,
      version: 2,
      message: `Bản sao thiếu nội dung nhị phân bắt buộc (${missingRequired.length} file). Không khôi phục để tránh desk trỏ tới file rỗng.`,
      missingRequired,
    };
  }

  const snap = local.snapshot();

  let previousKeys: string[] = [];
  try {
    previousKeys = await blobs.listKeys();
  } catch {
    return {
      ok: false,
      version: 2,
      message:
        "Không đọc được IndexedDB trước khi khôi phục — đã hủy để tránh ghi đè không hoàn tác được.",
    };
  }

  const incomingKeys = Object.keys(input.deskBlobs);
  const classified = classifyRestoreBlobKeys(incomingKeys, previousKeys);
  const { blobs: previousSnapshots, missing: snapshotMissing } = await blobs.getByKeys(
    classified.overwriteKeys,
  );
  if (snapshotMissing.length) {
    return {
      ok: false,
      version: 2,
      message: `Không sao chép được ${snapshotMissing.length} blob hiện có trước khi ghi đè — đã hủy khôi phục để bảo toàn dữ liệu cũ.`,
      blobsFailed: snapshotMissing.slice(0, 20),
    };
  }

  const { written, writtenKeys, failed } = await blobs.putBlobs(input.deskBlobs);

  const failWithRollback = async (
    message: string,
    extra?: Partial<RestoreV2Result>,
  ): Promise<RestoreV2Result> => {
    local.restoreSnapshot(snap);
    const rb = await rollbackFailedRestoreBlobs(blobs, {
      writtenKeys,
      previousSnapshots,
      novelKeys: classified.novelKeys,
    });
    if (!rb.ok) {
      return {
        ok: false,
        version: 2,
        recoveryIncomplete: true,
        message: `${message} localStorage đã hoàn tác. CẢNH BÁO: ${rb.detail || "không hoàn tác đủ IndexedDB"} — xuất bản sao từ thiết bị khác nếu cần.`,
        blobsWritten: written,
        ...extra,
      };
    }
    return {
      ok: false,
      version: 2,
      message: `${message} Đã giữ nguyên localStorage và hoàn tác blob đã ghi.`,
      blobsWritten: written,
      ...extra,
    };
  };

  if (failed.length) {
    return failWithRollback(
      `Ghi IndexedDB thất bại (${failed.length}/${incomingKeys.length} blob).`,
      { blobsFailed: failed.slice(0, 20) },
    );
  }

  try {
    const deskMeta = input.deskForLocalStorage(input.desk, input.deskBlobs);
    const ls = local.saveDeskMetadata(deskMeta);
    if (!ls.ok) {
      return failWithRollback(ls.reason || "Blob đã ghi nhưng không lưu được metadata.");
    }
    const prepared = local.prepareLearn(input.learn);
    local.saveLearn(prepared.learn);
    if (input.session && local.saveSession) local.saveSession(input.session);
    if (input.theme && local.setTheme) local.setTheme(input.theme);
    if (local.gcOrphans) {
      await local.gcOrphans(deskMeta);
    }
    return {
      ok: true,
      version: 2,
      message: `Đã khôi phục bản sao v2 (${written} blob).`,
      blobsWritten: written,
      legacyWarning: prepared.epochNote,
    };
  } catch (err) {
    return failWithRollback(
      err instanceof Error ? err.message : "Khôi phục thất bại sau khi ghi blob.",
    );
  }
}

/** In-memory blob store for deterministic tests (no IndexedDB). */
export function createMemoryBlobStore(
  initial?: Record<string, string>,
): RestoreV2BlobStore & {
  raw: Record<string, string>;
  /** Fail every put after `n` successful puts in a single putBlobs call. */
  failAfterSuccessfulPuts: number | null;
} {
  const raw: Record<string, string> = { ...(initial || {}) };
  const store = {
    raw,
    failAfterSuccessfulPuts: null as number | null,
    async listKeys() {
      return Object.keys(raw).sort();
    },
    async getByKeys(keys: string[]) {
      const blobs: Record<string, string> = {};
      const missing: string[] = [];
      for (const key of keys) {
        if (typeof raw[key] === "string") blobs[key] = raw[key];
        else missing.push(key);
      }
      return { blobs, missing };
    },
    async putBlobs(blobs: Record<string, string>) {
      let written = 0;
      const writtenKeys: string[] = [];
      const failed: string[] = [];
      const limit = store.failAfterSuccessfulPuts;
      for (const [id, data] of Object.entries(blobs)) {
        if (typeof data !== "string" || !data.length) {
          failed.push(id);
          continue;
        }
        if (limit !== null && written >= limit) {
          failed.push(id);
          continue;
        }
        raw[id] = data;
        written += 1;
        writtenKeys.push(id);
      }
      return { written, writtenKeys, failed };
    },
    async deleteBlobs(ids: string[]) {
      const deleted: string[] = [];
      const failed: string[] = [];
      for (const id of ids) {
        if (Object.prototype.hasOwnProperty.call(raw, id)) {
          delete raw[id];
          deleted.push(id);
        } else {
          deleted.push(id);
        }
      }
      return { deleted, failed };
    },
  };
  return store;
}
