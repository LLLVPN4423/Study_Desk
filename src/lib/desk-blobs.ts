/** IndexedDB blob store — keeps audio/PDF/image out of tiny localStorage. */

const DB_NAME = "study-desk-blobs";
const DB_VERSION = 1;
const STORE = "files";

export class DeskBlobError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "unavailable"
      | "open_failed"
      | "put_failed"
      | "get_failed"
      | "delete_failed"
      | "quota"
      | "aborted",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DeskBlobError";
  }
}

function mapDomError(err: unknown, fallback: DeskBlobError["code"]): DeskBlobError["code"] {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "QuotaExceededError") return "quota";
  if (name === "AbortError") return "aborted";
  return fallback;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new DeskBlobError("IndexedDB unavailable", "unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(
        new DeskBlobError("Không mở được kho tệp (IndexedDB).", "open_failed", req.error),
      );
  });
}

export async function putDeskBlob(id: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(dataUrl, id);
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          new DeskBlobError(
            "Ghi tệp bị hủy (IndexedDB).",
            mapDomError(tx.error, "aborted"),
            tx.error,
          ),
        );
      tx.onerror = () =>
        reject(
          new DeskBlobError(
            "Không ghi được tệp vào IndexedDB.",
            mapDomError(tx.error, "put_failed"),
            tx.error,
          ),
        );
    });
  } finally {
    db.close();
  }
}

/** Soft read — missing/unavailable → undefined (no throw). */
export async function getDeskBlob(id: string): Promise<string | undefined> {
  try {
    return await getDeskBlobStrict(id);
  } catch {
    return undefined;
  }
}

export async function getDeskBlobStrict(id: string): Promise<string | undefined> {
  const db = await openDb();
  try {
    return await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () =>
        reject(
          new DeskBlobError(
            "Không đọc được tệp từ IndexedDB.",
            mapDomError(req.error, "get_failed"),
            req.error,
          ),
        );
    });
  } finally {
    db.close();
  }
}

export async function deleteDeskBlob(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(
          new DeskBlobError(
            "Không xóa được blob IndexedDB.",
            mapDomError(tx.error, "delete_failed"),
            tx.error,
          ),
        );
    });
  } catch (err) {
    if (err instanceof DeskBlobError && err.code === "unavailable") return;
    throw err;
  } finally {
    db.close();
  }
}

export async function deleteDeskBlobs(
  ids: string[],
): Promise<{ deleted: string[]; failed: string[] }> {
  const deleted: string[] = [];
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await deleteDeskBlob(id);
      deleted.push(id);
    } catch (e) {
      failed.push(id);
      console.warn("[desk-blobs] delete failed", id, e instanceof Error ? e.message : e);
    }
  }
  if (failed.length === ids.length && ids.length > 0) {
    throw new DeskBlobError("Không xóa được các blob IndexedDB.", "delete_failed");
  }
  return { deleted, failed };
}

/** All keys currently stored in the Desk blob object store. */
export async function listDeskBlobKeys(): Promise<string[]> {
  const db = await openDb();
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result as IDBValidKey[]).map(String);
        keys.sort();
        resolve(keys);
      };
      req.onerror = () =>
        reject(
          new DeskBlobError(
            "Không liệt kê được khóa blob IndexedDB.",
            mapDomError(req.error, "get_failed"),
            req.error,
          ),
        );
    });
  } finally {
    db.close();
  }
}

/** Read many keys; returns found map + missing key list. */
export async function getDeskBlobsByKeys(
  keys: string[],
): Promise<{ blobs: Record<string, string>; missing: string[] }> {
  const blobs: Record<string, string> = {};
  const missing: string[] = [];
  for (const key of keys) {
    try {
      const value = await getDeskBlobStrict(key);
      if (value === undefined) missing.push(key);
      else blobs[key] = value;
    } catch {
      missing.push(key);
    }
  }
  return { blobs, missing };
}

export async function putDeskBlobs(
  blobs: Record<string, string>,
): Promise<{ written: number; writtenKeys: string[]; failed: string[] }> {
  let written = 0;
  const writtenKeys: string[] = [];
  const failed: string[] = [];
  for (const [id, data] of Object.entries(blobs)) {
    if (typeof data !== "string" || !data.length) {
      failed.push(id);
      continue;
    }
    try {
      await putDeskBlob(id, data);
      written += 1;
      writtenKeys.push(id);
    } catch (e) {
      failed.push(id);
      console.warn("[desk-blobs] put failed", id, e instanceof Error ? e.message : e);
    }
  }
  return { written, writtenKeys, failed };
}

export function userMessageForBlobError(err: unknown): string {
  if (err instanceof DeskBlobError) {
    if (err.code === "quota") {
      return "Hết dung lượng lưu trữ trình duyệt. Xóa bớt file hoặc xuất bản sao rồi thử lại.";
    }
    if (err.code === "unavailable") {
      return "Trình duyệt không hỗ trợ IndexedDB — không lưu được PDF/audio/ảnh.";
    }
    return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Lỗi kho tệp (IndexedDB).";
}
