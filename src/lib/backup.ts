"use client";

import {
  BACKUP_VERSION_CURRENT,
  WALLPAP_CUSTOM_BLOB_KEY,
  annBlobKey,
  buildBlobMetaFromFiles,
  contentBlobKey,
  findMissingRequiredBlobs,
  parseBackupJson,
  sourceBlobKey,
  stripDeskInlineBlobs,
  validateBackupPayload,
  type BackupPayload,
  type BackupPayloadV2,
  type BackupValidationError,
} from "./backup-format";
import { getDeskBlobsByKeys, putDeskBlobs, userMessageForBlobError } from "./desk-blobs";
import {
  hydrateDeskBlobs,
  loadDesk,
  saveDesk,
  type DeskFile,
  type DeskState,
} from "./desk-store";
import { loadLearn, saveLearn, type LearnState } from "./learn-store";
import { LEARN_PATHS_EPOCH } from "./learn-store-core";
import { prepareLearnForRestore } from "./learn-epoch";
import { loadSession, saveSession, type SessionUser } from "./session";
import { STORAGE_KEYS } from "./storage-keys";

/** Bump pathsEpoch so the next loadLearn does not treat restore as a wipe candidate. */
function learnForRestore(learn: LearnState): { learn: LearnState; epochNote?: string } {
  return prepareLearnForRestore(learn, LEARN_PATHS_EPOCH);
}

export type {
  BackupPayload,
  BackupPayloadV1,
  BackupPayloadV2,
  BackupBlobMeta,
  BackupValidationError,
} from "./backup-format";

export {
  parseBackupJson,
  validateBackupPayload,
  findMissingRequiredBlobs,
  BACKUP_VERSION_CURRENT,
  BACKUP_VERSION_LEGACY,
} from "./backup-format";

export type RestoreResult = {
  ok: boolean;
  version?: 1 | 2;
  message: string;
  blobsWritten?: number;
  blobsFailed?: string[];
  missingRequired?: string[];
  legacyWarning?: string;
};

type StorageSnapshot = {
  desk: string | null;
  learn: string | null;
  session: string | null;
  theme: string | null;
};

function snapshotStorage(): StorageSnapshot {
  return {
    desk: localStorage.getItem(STORAGE_KEYS.desk),
    learn: localStorage.getItem(STORAGE_KEYS.learn),
    session: localStorage.getItem(STORAGE_KEYS.session),
    theme: localStorage.getItem(STORAGE_KEYS.theme),
  };
}

function restoreSnapshot(snap: StorageSnapshot) {
  const apply = (key: string, value: string | null) => {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  };
  try {
    apply(STORAGE_KEYS.desk, snap.desk);
    apply(STORAGE_KEYS.learn, snap.learn);
    apply(STORAGE_KEYS.session, snap.session);
    apply(STORAGE_KEYS.theme, snap.theme);
  } catch (err) {
    console.warn("[backup] snapshot restore failed", err instanceof Error ? err.message : err);
  }
}

function collectCandidateKeys(desk: DeskState): string[] {
  const keys = new Set<string>();
  for (const f of desk.files) {
    keys.add(f.id);
    keys.add(sourceBlobKey(f.id));
    keys.add(contentBlobKey(f.id));
    keys.add(annBlobKey(f.id));
  }
  if (desk.wallpaper === "custom") keys.add(WALLPAP_CUSTOM_BLOB_KEY);
  return [...keys];
}

function mergeMemoryBlobs(desk: DeskState, blobs: Record<string, string>) {
  for (const f of desk.files) {
    if (f.dataUrl && !blobs[f.id]) blobs[f.id] = f.dataUrl;
    if (f.sourceDataUrl && !blobs[sourceBlobKey(f.id)]) {
      blobs[sourceBlobKey(f.id)] = f.sourceDataUrl;
    }
    if (typeof f.content === "string" && f.content.length > 0 && !blobs[contentBlobKey(f.id)]) {
      blobs[contentBlobKey(f.id)] = f.content;
    }
    if (
      Array.isArray(f.pdfAnnotations) &&
      f.pdfAnnotations.length > 0 &&
      !blobs[annBlobKey(f.id)]
    ) {
      blobs[annBlobKey(f.id)] = JSON.stringify(f.pdfAnnotations);
    }
  }
}

function deskForLocalStorage(desk: DeskState, blobs: Record<string, string>): DeskState {
  const files: DeskFile[] = desk.files.map((f) => {
    const next: DeskFile = { ...f };
    delete next.dataUrl;
    delete next.sourceDataUrl;
    // Prefer inline note/doc content so LS remains usable before hydrate
    if ((!next.content || !next.content.length) && blobs[contentBlobKey(f.id)]) {
      next.content = blobs[contentBlobKey(f.id)];
    }
    if (
      (!next.pdfAnnotations || !next.pdfAnnotations.length) &&
      blobs[annBlobKey(f.id)]
    ) {
      try {
        const parsed = JSON.parse(blobs[annBlobKey(f.id)]!) as unknown[];
        if (Array.isArray(parsed)) next.pdfAnnotations = parsed;
      } catch {
        /* ignore bad ann */
      }
    }
    return next;
  });
  return { ...desk, files };
}

/** Build v2 backup including IndexedDB blob contents. */
export async function buildBackupAsync(): Promise<BackupPayloadV2> {
  const hydrated = await hydrateDeskBlobs(loadDesk());
  const keys = collectCandidateKeys(hydrated);
  const { blobs } = await getDeskBlobsByKeys(keys);
  mergeMemoryBlobs(hydrated, blobs);

  // Drop empty optional keys (source/content/ann that were never written)
  for (const key of [...Object.keys(blobs)]) {
    if (!blobs[key]) delete blobs[key];
  }

  const desk = stripDeskInlineBlobs(hydrated) as DeskState;
  const blobMeta = buildBlobMetaFromFiles(hydrated.files, blobs);

  return {
    version: BACKUP_VERSION_CURRENT,
    exportedAt: new Date().toISOString(),
    session: loadSession(),
    desk,
    learn: loadLearn(),
    theme: localStorage.getItem(STORAGE_KEYS.theme) || undefined,
    deskBlobs: blobs,
    blobMeta,
  };
}

/** @deprecated Prefer buildBackupAsync — sync export omits IndexedDB blobs. */
export function buildBackup(): BackupPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    session: loadSession(),
    desk: loadDesk(),
    learn: loadLearn(),
    theme: localStorage.getItem(STORAGE_KEYS.theme) || undefined,
  };
}

export async function downloadBackup(): Promise<{ ok: boolean; message: string; bytes?: number }> {
  try {
    const payload = await buildBackupAsync();
    const missing = findMissingRequiredBlobs(payload.desk, payload.deskBlobs);
    const text = JSON.stringify(payload);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `study-desk-backup-${payload.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (missing.length) {
      return {
        ok: true,
        bytes: blob.size,
        message: `Đã xuất bản sao (v2, ${Object.keys(payload.deskBlobs).length} blob). Cảnh báo: thiếu nội dung cho ${missing.length} file nhị phân — kiểm tra các file PDF/audio/ảnh trên bàn.`,
      };
    }
    return {
      ok: true,
      bytes: blob.size,
      message: `Đã xuất bản sao v2 (${Object.keys(payload.deskBlobs).length} tệp blob, ~${Math.round(blob.size / 1024)} KB).`,
    };
  } catch (err) {
    return {
      ok: false,
      message: userMessageForBlobError(err) || "Không xuất được bản sao.",
    };
  }
}

function validationMessage(err: BackupValidationError): string {
  return err.message;
}

/**
 * Restore backup. Overwrites desk/learn/session/theme like prior versions.
 * On critical blob failure, rolls localStorage back to the pre-restore snapshot
 * (orphan blob keys may remain in IndexedDB).
 */
export async function restoreBackupAsync(raw: string): Promise<RestoreResult> {
  const parsed = parseBackupJson(raw);
  if (!parsed.ok) {
    return { ok: false, message: validationMessage(parsed.error) };
  }
  const validated = validateBackupPayload(parsed.data);
  if (!validated.ok) {
    return { ok: false, message: validationMessage(validated.error) };
  }

  const data = validated.payload;
  const snap = snapshotStorage();

  if (data.version === 1) {
    try {
      const desk = data.desk as unknown as DeskState;
      const learn = data.learn as LearnState;
      const ls = saveDesk(desk);
      if (!ls.ok) {
        restoreSnapshot(snap);
        return {
          ok: false,
          version: 1,
          message: ls.reason || "Không ghi được desk metadata.",
        };
      }
      const prepared = learnForRestore(learn);
      saveLearn(prepared.learn);
      if (data.session) saveSession(data.session as SessionUser);
      if (data.theme) localStorage.setItem(STORAGE_KEYS.theme, data.theme);
      return {
        ok: true,
        version: 1,
        message: "Đã khôi phục metadata (bản v1).",
        legacyWarning: [
          "Bản sao lưu v1 không gồm PDF/audio/ảnh trong IndexedDB — chỉ ghi chú/metadata. Xuất lại từ Settings để có bản v2 đầy đủ.",
          prepared.epochNote,
        ]
          .filter(Boolean)
          .join(" "),
      };
    } catch (err) {
      restoreSnapshot(snap);
      return {
        ok: false,
        version: 1,
        message: err instanceof Error ? err.message : "Khôi phục v1 thất bại.",
      };
    }
  }

  const missingRequired = findMissingRequiredBlobs(data.desk, data.deskBlobs);
  if (missingRequired.length) {
    return {
      ok: false,
      version: 2,
      message: `Bản sao thiếu nội dung nhị phân bắt buộc (${missingRequired.length} file). Không khôi phục để tránh desk trỏ tới file rỗng.`,
      missingRequired,
    };
  }

  const { written, failed } = await putDeskBlobs(data.deskBlobs);
  if (failed.length) {
    restoreSnapshot(snap);
    return {
      ok: false,
      version: 2,
      message: `Ghi IndexedDB thất bại (${failed.length}/${Object.keys(data.deskBlobs).length} blob). Đã giữ nguyên dữ liệu cũ trên localStorage. Thử xóa bớt dữ liệu trình duyệt hoặc xuất bản sao từ thiết bị nguồn rồi thử lại.`,
      blobsWritten: written,
      blobsFailed: failed.slice(0, 20),
    };
  }

  try {
    const deskMeta = deskForLocalStorage(data.desk as unknown as DeskState, data.deskBlobs);
    // Metadata only — blobs already written; avoid re-put storm
    const ls = saveDesk({
      ...deskMeta,
      files: deskMeta.files.map((f) => {
        const meta = { ...f };
        delete meta.dataUrl;
        delete meta.sourceDataUrl;
        return meta;
      }),
    });
    if (!ls.ok) {
      restoreSnapshot(snap);
      return {
        ok: false,
        version: 2,
        message: ls.reason || "Blob đã ghi nhưng không lưu được metadata — đã hoàn tác localStorage.",
        blobsWritten: written,
      };
    }
    const prepared = learnForRestore(data.learn as LearnState);
    saveLearn(prepared.learn);
    if (data.session) saveSession(data.session as SessionUser);
    if (data.theme) localStorage.setItem(STORAGE_KEYS.theme, data.theme);
    return {
      ok: true,
      version: 2,
      message: `Đã khôi phục bản sao v2 (${written} blob).`,
      blobsWritten: written,
      legacyWarning: prepared.epochNote,
    };
  } catch (err) {
    restoreSnapshot(snap);
    return {
      ok: false,
      version: 2,
      message: err instanceof Error ? err.message : "Khôi phục thất bại sau khi ghi blob.",
      blobsWritten: written,
    };
  }
}

/** Sync restore kept for callers; prefers async path. */
export function restoreBackup(raw: string) {
  const parsed = parseBackupJson(raw);
  if (!parsed.ok) throw new Error(parsed.error.message);
  const validated = validateBackupPayload(parsed.data);
  if (!validated.ok) throw new Error(validated.error.message);
  const data = validated.payload;
  if (data.version === 2) {
    throw new Error("Dùng restoreBackupAsync cho bản sao v2 (có blob IndexedDB).");
  }
  saveDesk(data.desk as unknown as DeskState);
  saveLearn(data.learn as LearnState);
  if (data.session) saveSession(data.session as SessionUser);
  if (data.theme) localStorage.setItem(STORAGE_KEYS.theme, data.theme);
  return data;
}
