/**
 * Giữ FileSystemFileHandle để Ctrl+S / Lưu ghi đè đúng file trên máy (Chrome/Edge).
 * Handle lưu trong IndexedDB (có thể serialize).
 * Safari/Firefox: không có showOpenFilePicker — dùng <input type="file"> (không có handle ghi đè).
 */

import { DESK_ACCEPT, MUSIC_ACCEPT } from "./desk-formats";

const DB_NAME = "study-desk-handles";
const DB_VERSION = 1;
const STORE = "handles";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IDB open failed"));
  });
}

export function supportsOpenFilePicker(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as Window & { showOpenFilePicker?: unknown }).showOpenFilePicker === "function";
}

/**
 * Standard file input — works in Safari/Firefox. Cancellation → empty array (not an error).
 */
export function pickFilesViaInput(opts?: {
  accept?: string;
  multiple?: boolean;
}): Promise<File[]> {
  const accept = opts?.accept ?? `${DESK_ACCEPT},${MUSIC_ACCEPT}`;
  const multiple = opts?.multiple !== false;
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve([]);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.hidden = true;
    let settled = false;
    const finish = (files: File[]) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onFocus);
      input.remove();
      resolve(files);
    };
    const onFocus = () => {
      // User cancelled: change may never fire; settle after focus returns.
      window.setTimeout(() => {
        if (!settled) finish(Array.from(input.files || []));
      }, 400);
    };
    input.addEventListener("change", () => {
      finish(Array.from(input.files || []));
    });
    document.body.appendChild(input);
    window.addEventListener("focus", onFocus);
    input.click();
  });
}

/** Minimal types — TS DOM lib chưa đủ File System Access. */
export type DeskFileHandle = {
  name: string;
  kind?: string;
  getFile: () => Promise<File>;
  requestPermission: (opts: {
    mode?: "read" | "readwrite";
  }) => Promise<PermissionState | "prompt" | "granted" | "denied">;
  createWritable: () => Promise<{
    write: (data: BufferSource | Blob | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type SavePickerType = {
  description?: string;
  accept: Record<string, string[]>;
};

export async function getFileHandle(fileId: string): Promise<DeskFileHandle | null> {
  try {
    const db = await openDb();
    const value = await new Promise<DeskFileHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(fileId);
      req.onsuccess = () => resolve((req.result as DeskFileHandle) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return value;
  } catch {
    return null;
  }
}

export async function setFileHandle(fileId: string, handle: DeskFileHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, fileId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("handle put failed"));
  });
  db.close();
}

export async function deleteFileHandle(fileId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("handle delete failed"));
    });
    db.close();
  } catch {
    /* ignore */
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta?.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  const binary = atob(b64 || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function looksLikeHtml(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(s.trim());
}

function htmlToPlainText(html: string) {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").replace(/\u00a0/g, " ");
}

/** HTML TipTap → markdown tối giản khi ghi .md ra máy. */
function htmlToLooseMarkdown(html: string) {
  if (!looksLikeHtml(html)) return html;
  if (typeof document === "undefined") return htmlToPlainText(html);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const lines: string[] = [];
  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "h1") lines.push(`# ${(el.textContent || "").trim()}`, "");
    else if (tag === "h2") lines.push(`## ${(el.textContent || "").trim()}`, "");
    else if (tag === "h3") lines.push(`### ${(el.textContent || "").trim()}`, "");
    else if (tag === "p" || tag === "div") {
      const t = (el.textContent || "").trim();
      if (t) lines.push(t, "");
    } else if (tag === "li") lines.push(`- ${(el.textContent || "").trim()}`);
    else if (tag === "br") lines.push("");
    else [...el.children].forEach(walk);
  };
  [...doc.body.children].forEach(walk);
  const out = lines.join("\n").trim();
  return out || htmlToPlainText(html);
}

export function blobFromEditedDeskFile(file: {
  kind: string;
  name: string;
  content?: string;
  dataUrl?: string;
}): Blob | null {
  const lower = file.name.toLowerCase();

  // Word: luôn ưu tiên bytes .docx đã bake
  if (file.kind === "doc" && file.dataUrl?.startsWith("data:")) {
    return dataUrlToBlob(file.dataUrl);
  }

  // PDF / ảnh / audio
  if (file.dataUrl && (file.kind === "pdf" || file.kind === "image" || file.kind === "audio")) {
    return dataUrlToBlob(file.dataUrl);
  }

  if (typeof file.content === "string") {
    let body = file.content;
    let mime = "text/plain;charset=utf-8";

    if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
      body = htmlToLooseMarkdown(body);
      mime = "text/markdown;charset=utf-8";
    } else if (lower.endsWith(".html") || lower.endsWith(".htm")) {
      mime = "text/html;charset=utf-8";
    } else if (
      lower.endsWith(".txt") ||
      lower.endsWith(".csv") ||
      lower.endsWith(".json") ||
      lower.endsWith(".log") ||
      lower.endsWith(".rtf")
    ) {
      if (looksLikeHtml(body)) body = htmlToPlainText(body);
      mime = lower.endsWith(".json")
        ? "application/json;charset=utf-8"
        : lower.endsWith(".csv")
          ? "text/csv;charset=utf-8"
          : "text/plain;charset=utf-8";
    } else if (file.kind === "doc") {
      // chưa bake dataUrl — tạm HTML
      mime = "text/html;charset=utf-8";
    } else if (looksLikeHtml(body)) {
      mime = "text/html;charset=utf-8";
    }

    return new Blob([body], { type: mime });
  }

  if (file.dataUrl) return dataUrlToBlob(file.dataUrl);
  return null;
}

function pickerTypesFor(name: string, kind: string): SavePickerType[] {
  const lower = name.toLowerCase();
  if (kind === "pdf" || lower.endsWith(".pdf")) {
    return [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }];
  }
  if (kind === "doc" || lower.endsWith(".docx") || lower.endsWith(".doc")) {
    return [
      {
        description: "Word",
        accept: {
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
        },
      },
    ];
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return [{ description: "Markdown", accept: { "text/markdown": [".md", ".markdown"] } }];
  }
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return [{ description: "HTML", accept: { "text/html": [".html", ".htm"] } }];
  }
  return [{ description: "Text", accept: { "text/plain": [".txt"] } }];
}

export type DiskWriteResult =
  | { ok: true; mode: "overwrite" | "picker" }
  | {
      ok: false;
      reason: "unsupported" | "cancelled" | "denied" | "empty" | "no-handle" | string;
    };

export async function hasFileHandle(fileId: string): Promise<boolean> {
  return Boolean(await getFileHandle(fileId));
}

/** Một mục đầu = mặc định hiện đủ PDF + Word + TXT/MD + ảnh (tránh Chrome kẹt filter PDF). */
const OPEN_PICKER_TYPES: SavePickerType[] = [
  {
    description: "Tài liệu học (PDF, Word, TXT, MD, HTML, ảnh)",
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "text/plain": [".txt", ".csv", ".log", ".rtf"],
      "text/markdown": [".md", ".markdown"],
      "text/html": [".html", ".htm"],
      "application/json": [".json"],
      "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp"],
    },
  },
  { description: "Chỉ PDF", accept: { "application/pdf": [".pdf"] } },
  {
    description: "Chỉ Word",
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
    },
  },
  {
    description: "Chỉ văn bản",
    accept: {
      "text/plain": [".txt", ".csv", ".log", ".rtf"],
      "text/markdown": [".md", ".markdown"],
      "text/html": [".html", ".htm"],
      "application/json": [".json"],
    },
  },
];

export type PickedDeskFile = {
  file: File;
  /** Present only when File System Access API succeeded (Chromium). */
  handle?: DeskFileHandle;
  /** True when opened via <input type=file> fallback. */
  viaInputFallback?: boolean;
};

/**
 * Mở file từ máy kèm quyền ghi — Ctrl+S sau đó ghi đè thẳng (Chrome/Edge).
 * Safari/Firefox: fallback `<input type="file">` (không có handle ghi đè).
 * - `[]` = user cancelled
 * - `null` = only if window unavailable (SSR)
 */
export async function pickDeskFilesFromDisk(): Promise<PickedDeskFile[] | null> {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    showOpenFilePicker?: (opts?: {
      multiple?: boolean;
      types?: SavePickerType[];
      excludeAcceptAllOption?: boolean;
    }) => Promise<DeskFileHandle[]>;
  };

  if (typeof w.showOpenFilePicker === "function") {
    try {
      const handles = await w.showOpenFilePicker({
        multiple: true,
        types: OPEN_PICKER_TYPES,
        excludeAcceptAllOption: false,
      });
      const out: PickedDeskFile[] = [];
      for (const handle of handles) {
        try {
          await handle.requestPermission({ mode: "readwrite" });
        } catch {
          /* vẫn đọc được; ghi có thể hỏi lại lúc Ctrl+S */
        }
        const file = await handle.getFile();
        out.push({ file, handle });
      }
      return out;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "AbortError") return [];
      // Unexpected FS API failure → try input fallback rather than hard-fail
      console.warn("[file-handles] showOpenFilePicker failed, using input fallback", name || err);
    }
  }

  const files = await pickFilesViaInput({
    accept: `${DESK_ACCEPT},${MUSIC_ACCEPT}`,
    multiple: true,
  });
  return files.map((file) => ({ file, viaInputFallback: true }));
}

/**
 * Ghi blob ra máy.
 * - Mặc định: chỉ ghi nếu đã có handle («Mở từ máy») — không hiện Save As.
 * - `forcePicker: true`: nút «Ghi ra máy» — hỏi chỗ lưu nếu chưa có handle.
 */
export async function writeBlobToDisk(
  fileId: string,
  fileName: string,
  kind: string,
  blob: Blob,
  opts?: { forcePicker?: boolean },
): Promise<DiskWriteResult> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "unsupported" };
  }

  const forcePicker = Boolean(opts?.forcePicker);
  const existing = await getFileHandle(fileId);
  if (existing) {
    try {
      const perm = await existing.requestPermission({ mode: "readwrite" });
      if (perm === "granted") {
        const writable = await existing.createWritable();
        await writable.write(blob);
        await writable.close();
        return { ok: true, mode: "overwrite" };
      }
    } catch {
      if (!forcePicker) return { ok: false, reason: "denied" };
    }
  }

  if (!forcePicker) {
    return { ok: false, reason: "no-handle" };
  }

  const w = window as Window & {
    showSaveFilePicker?: (opts?: {
      suggestedName?: string;
      types?: SavePickerType[];
    }) => Promise<DeskFileHandle>;
  };
  if (typeof w.showSaveFilePicker !== "function") {
    return { ok: false, reason: "unsupported" };
  }

  try {
    const handle = await w.showSaveFilePicker({
      suggestedName: fileName,
      types: pickerTypesFor(fileName, kind),
    });
    await setFileHandle(fileId, handle);
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { ok: true, mode: "picker" };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "AbortError") return { ok: false, reason: "cancelled" };
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "denied",
    };
  }
}
