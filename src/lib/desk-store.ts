"use client";

import { deleteDeskBlob, getDeskBlob, putDeskBlob } from "./desk-blobs";
import { FREE_LIMITS } from "./freemium";
import { STORAGE_KEYS, type ThemeId } from "./storage-keys";

export type DeskFileKind = "pdf" | "note" | "audio" | "image" | "doc";

export type DeskOutput = {
  id: string;
  kind: "note" | "card" | "clip";
  title: string;
  body: string;
  createdAt: string;
};

export type DeskFile = {
  id: string;
  name: string;
  kind: DeskFileKind;
  size: number;
  tag: string;
  folderId: string | null;
  createdAt: string;
  updatedAt?: string;
  dataUrl?: string;
  /**
   * Bản upload gốc (PDF/DOCX) — giữ để nút «Gốc».
   * Lưu IDB key `source:{id}`; không ghi vào localStorage.
   */
  sourceDataUrl?: string;
  /** Editable body for note / doc (extracted or plain text / HTML). */
  content?: string;
  notes?: string;
  /** Inkbar PDF annotations (JSON-serializable). */
  pdfAnnotations?: unknown[];
  /** Study outputs pushed to the right studio pane (NotebookLM-style). */
  outputs?: DeskOutput[];
};

export type DeskFolder = {
  id: string;
  name: string;
};

export type DeskTask = {
  id: string;
  title: string;
  due: string;
  done: boolean;
};

export type DeskScheduleEvent = {
  id: string;
  /** Short label in settings (e.g. "Ngày thi chính thức"). */
  label: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time: string;
};

export type DeskState = {
  version: number;
  files: DeskFile[];
  folders: DeskFolder[];
  tasks: DeskTask[];
  theme: ThemeId;
  studyRoomUrl: string;
  /** Focus length in total seconds (user-tuned digital clock). */
  focusSeconds: number;
  scheduleTitle: string;
  schedule: DeskScheduleEvent[];
};

export const FOCUS_PRESETS_MIN = [15, 25, 45, 60] as const;
/** @deprecated use FOCUS_PRESETS_MIN */
export const FOCUS_PRESETS = FOCUS_PRESETS_MIN;
export const DESK_VERSION = 5;
export const MAX_SCHEDULE_EVENTS = 5;

const DEMO_TASK_IDS = new Set(["t1", "t2", "t3"]);
const DEMO_TASK_TITLES = new Set([
  "Review chapter 14",
  "Complete 20 reviews",
  "Listen: week 4 drill",
]);
const DEMO_FOLDER_IDS = new Set(["f-jp", "f-en"]);

const defaultDesk = (): DeskState => ({
  version: DESK_VERSION,
  files: [],
  folders: [],
  tasks: [],
  theme: "paper",
  studyRoomUrl: "",
  focusSeconds: 25 * 60,
  scheduleTitle: "Lịch trình môn học",
  schedule: [],
});

function isDemoTask(t: DeskTask) {
  return DEMO_TASK_IDS.has(t.id) || DEMO_TASK_TITLES.has(t.title);
}

function scrubDesignSeeds(state: DeskState): DeskState {
  const tasks = (state.tasks || []).filter((t) => !isDemoTask(t));
  const usedFolderIds = new Set(
    (state.files || []).map((f) => f.folderId).filter(Boolean) as string[],
  );
  const folders = (state.folders || []).filter((f) => {
    if (!DEMO_FOLDER_IDS.has(f.id)) return true;
    return usedFolderIds.has(f.id);
  });

  const legacyMinutes = (state as DeskState & { focusMinutes?: number }).focusMinutes;
  let focusSeconds = state.focusSeconds;
  if (typeof focusSeconds !== "number" || focusSeconds <= 0) {
    focusSeconds =
      typeof legacyMinutes === "number" && legacyMinutes > 0
        ? legacyMinutes * 60
        : 25 * 60;
  }
  focusSeconds = Math.min(99 * 60 + 59, Math.max(60, Math.round(focusSeconds)));

  return {
    ...state,
    version: DESK_VERSION,
    tasks,
    folders,
    focusSeconds,
  };
}

function contentBlobKey(id: string) {
  return `content:${id}`;
}

function annBlobKey(id: string) {
  return `ann:${id}`;
}

function sourceBlobKey(id: string) {
  return `source:${id}`;
}

/** Ghi blob file lên IndexedDB và đợi xong (dùng sau bake PDF/DOCX). */
export async function persistFileBlobs(file: DeskFile): Promise<void> {
  const jobs: Promise<void>[] = [];
  if (file.dataUrl) jobs.push(putDeskBlob(file.id, file.dataUrl));
  if (file.sourceDataUrl) {
    jobs.push(putDeskBlob(sourceBlobKey(file.id), file.sourceDataUrl));
  }
  if (typeof file.content === "string" && file.content.length > 0) {
    jobs.push(putDeskBlob(contentBlobKey(file.id), file.content));
  }
  if (file.pdfAnnotations && Array.isArray(file.pdfAnnotations) && file.pdfAnnotations.length > 0) {
    jobs.push(putDeskBlob(annBlobKey(file.id), JSON.stringify(file.pdfAnnotations)));
  } else {
    jobs.push(deleteDeskBlob(annBlobKey(file.id)));
  }
  await Promise.all(jobs);
}

export function loadDesk(): DeskState {
  if (typeof window === "undefined") return defaultDesk();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.desk);
    if (!raw) return defaultDesk();
    const parsedRaw = JSON.parse(raw) as Partial<DeskState> & { focusMinutes?: number };
    const storedVersion =
      typeof parsedRaw.version === "number" ? parsedRaw.version : 1;
    const parsed = { ...defaultDesk(), ...parsedRaw } as DeskState;
    parsed.files = (parsed.files || []).map((f) => {
      const rawKind = String((f as { kind?: string }).kind || "note");
      const kind: DeskFileKind =
        rawKind === "mp3" ? "audio" : normalizeStoredKind(rawKind);
      return {
        ...f,
        kind,
        folderId: f.folderId ?? null,
        tag: f.tag || defaultTagForKind(kind),
      };
    });
    if (!Array.isArray(parsed.folders)) parsed.folders = [];
    if (!Array.isArray(parsed.tasks)) parsed.tasks = [];
    if (parsed.studyRoomUrl === undefined) parsed.studyRoomUrl = "";
    if (!parsed.scheduleTitle) parsed.scheduleTitle = "Lịch trình môn học";
    if (!Array.isArray(parsed.schedule)) parsed.schedule = [];

    const scrubbed = scrubDesignSeeds({ ...parsed, version: storedVersion });
    const dirty =
      storedVersion < DESK_VERSION ||
      scrubbed.tasks.length !== (parsed.tasks || []).length ||
      scrubbed.focusSeconds !== parsed.focusSeconds;
    if (dirty) saveDesk(scrubbed);
    return scrubbed;
  } catch {
    return defaultDesk();
  }
}

export function saveDesk(state: DeskState): { ok: boolean; reason?: string } {
  const clean = {
    ...state,
    version: DESK_VERSION,
    tasks: (state.tasks || []).filter((t) => !isDemoTask(t)),
  };
  for (const f of clean.files) {
    if (f.dataUrl) {
      void putDeskBlob(f.id, f.dataUrl).catch(() => {});
    }
    if (f.sourceDataUrl) {
      void putDeskBlob(sourceBlobKey(f.id), f.sourceDataUrl).catch(() => {});
    }
    if (typeof f.content === "string" && f.content.length > 0) {
      void putDeskBlob(contentBlobKey(f.id), f.content).catch(() => {});
    }
    if (f.pdfAnnotations && Array.isArray(f.pdfAnnotations) && f.pdfAnnotations.length > 0) {
      void putDeskBlob(annBlobKey(f.id), JSON.stringify(f.pdfAnnotations)).catch(() => {});
    }
    // Không xóa ann ở đây khi rỗng — tránh race: dataUrl bake chưa ghi IDB mà ann đã mất.
    // persistFileBlobs() xóa ann sau khi bake đã await put dataUrl.
  }
  const forLs = {
    ...clean,
    files: clean.files.map(({ dataUrl: _d, sourceDataUrl: _s, ...meta }) => meta),
  };
  try {
    localStorage.setItem(STORAGE_KEYS.desk, JSON.stringify(forLs));
  } catch {
    try {
      // Last resort: drop bulky fields from LS (still in IndexedDB)
      const slim = {
        ...forLs,
        files: forLs.files.map(
          ({ outputs: _o, pdfAnnotations: _p, content: _c, ...meta }) => meta,
        ),
      };
      localStorage.setItem(STORAGE_KEYS.desk, JSON.stringify(slim));
    } catch {
      document.documentElement.dataset.theme =
        clean.theme === "paper" ? "" : clean.theme;
      localStorage.setItem(STORAGE_KEYS.theme, clean.theme);
      return { ok: false, reason: "Không ghi được localStorage (quota)." };
    }
  }
  document.documentElement.dataset.theme =
    clean.theme === "paper" ? "" : clean.theme;
  localStorage.setItem(STORAGE_KEYS.theme, clean.theme);
  return { ok: true };
}

/** Attach dataUrl + content from IndexedDB (and migrate legacy inlined blobs). */
export async function hydrateDeskBlobs(state: DeskState): Promise<DeskState> {
  let migrated = false;
  const files = await Promise.all(
    state.files.map(async (f) => {
      let next = f;
      if (f.dataUrl) {
        await putDeskBlob(f.id, f.dataUrl).catch(() => {});
        migrated = true;
      } else {
        const dataUrl = await getDeskBlob(f.id);
        if (dataUrl) next = { ...next, dataUrl };
      }
      if (f.sourceDataUrl) {
        await putDeskBlob(sourceBlobKey(f.id), f.sourceDataUrl).catch(() => {});
      } else {
        const sourceDataUrl = await getDeskBlob(sourceBlobKey(f.id));
        if (sourceDataUrl) next = { ...next, sourceDataUrl };
      }
      if (typeof f.content === "string" && f.content.length > 0) {
        await putDeskBlob(contentBlobKey(f.id), f.content).catch(() => {});
      } else {
        const stored = await getDeskBlob(contentBlobKey(f.id));
        if (stored) next = { ...next, content: stored };
      }
      if (f.pdfAnnotations && Array.isArray(f.pdfAnnotations) && f.pdfAnnotations.length > 0) {
        await putDeskBlob(annBlobKey(f.id), JSON.stringify(f.pdfAnnotations)).catch(() => {});
      } else {
        const rawAnn = await getDeskBlob(annBlobKey(f.id));
        if (rawAnn) {
          try {
            const parsed = JSON.parse(rawAnn) as unknown[];
            if (Array.isArray(parsed)) next = { ...next, pdfAnnotations: parsed };
          } catch {
            /* ignore */
          }
        }
      }
      return next;
    }),
  );
  const next = { ...state, files };
  if (migrated) saveDesk(next);
  return next;
}

export function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme === "paper" ? "" : theme;
}

export function usedStorageBytes(files: DeskFile[]) {
  return files.reduce((sum, f) => sum + (f.size || 0), 0);
}

export function canUpload(files: DeskFile[], size: number) {
  if (files.length >= FREE_LIMITS.maxFiles) {
    return {
      ok: false as const,
      reason: `File limit reached on Free (${FREE_LIMITS.maxFiles}).`,
    };
  }
  if (usedStorageBytes(files) + size > FREE_LIMITS.maxStorageBytes) {
    return {
      ok: false as const,
      reason: `Storage limit reached on Free (${formatBytes(FREE_LIMITS.maxStorageBytes)}).`,
    };
  }
  return { ok: true as const };
}

export function canAddFolder(folders: DeskFolder[]) {
  if (folders.length >= FREE_LIMITS.maxFolders) {
    return {
      ok: false as const,
      reason: `Folder limit on Free (${FREE_LIMITS.maxFolders}).`,
    };
  }
  return { ok: true as const };
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function byteLengthOfText(text: string) {
  return new TextEncoder().encode(text).length;
}

const NOTE_NAME_EXT = /\.(md|markdown|txt|csv|json|html?|rtf|log)$/i;

export function createNoteFile(input: {
  name?: string;
  folderId?: string | null;
  content?: string;
}): DeskFile {
  const content = input.content ?? "";
  const raw = input.name?.trim() || "Ghi chú mới";
  // Giữ đuôi gốc (.txt/.md/…) — chỉ thêm .md khi tạo ghi chú mới không có đuôi
  const name = NOTE_NAME_EXT.test(raw) ? raw : `${raw.replace(/\.$/, "")}.md`;
  return {
    id: crypto.randomUUID(),
    name,
    kind: "note",
    size: byteLengthOfText(content),
    tag: "Note",
    folderId: input.folderId ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    content,
    notes: "",
  };
}

export function patchFile(
  state: DeskState,
  id: string,
  patch: Partial<DeskFile>,
): DeskState {
  return {
    ...state,
    files: state.files.map((f) =>
      f.id === id
        ? {
            ...f,
            ...patch,
            updatedAt: new Date().toISOString(),
            size:
              patch.content !== undefined
                ? byteLengthOfText(patch.content)
                : patch.size !== undefined
                  ? patch.size
                  : f.size,
          }
        : f,
    ),
  };
}

export function deleteFile(state: DeskState, id: string): DeskState {
  void deleteDeskBlob(id);
  void deleteDeskBlob(contentBlobKey(id));
  void deleteDeskBlob(annBlobKey(id));
  void deleteDeskBlob(sourceBlobKey(id));
  void import("./file-handles").then((m) => m.deleteFileHandle(id)).catch(() => {});
  return { ...state, files: state.files.filter((f) => f.id !== id) };
}

export function pushFileOutput(
  state: DeskState,
  fileId: string,
  output: Omit<DeskOutput, "id" | "createdAt"> & { id?: string; createdAt?: string },
): DeskState {
  const entry: DeskOutput = {
    id: output.id || crypto.randomUUID(),
    kind: output.kind,
    title: output.title,
    body: output.body,
    createdAt: output.createdAt || new Date().toISOString(),
  };
  return {
    ...state,
    files: state.files.map((f) =>
      f.id === fileId
        ? {
            ...f,
            updatedAt: new Date().toISOString(),
            outputs: [entry, ...(f.outputs || [])].slice(0, 40),
          }
        : f,
    ),
  };
}

export function removeFileOutput(
  state: DeskState,
  fileId: string,
  outputId: string,
): DeskState {
  return {
    ...state,
    files: state.files.map((f) =>
      f.id === fileId
        ? {
            ...f,
            outputs: (f.outputs || []).filter((o) => o.id !== outputId),
            updatedAt: new Date().toISOString(),
          }
        : f,
    ),
  };
}

export function deleteFolder(state: DeskState, folderId: string): DeskState {
  return {
    ...state,
    folders: state.folders.filter((f) => f.id !== folderId),
    files: state.files.map((f) =>
      f.folderId === folderId ? { ...f, folderId: null } : f,
    ),
  };
}

function normalizeStoredKind(kind: string): DeskFileKind {
  if (kind === "pdf" || kind === "note" || kind === "audio" || kind === "image" || kind === "doc") {
    return kind;
  }
  return "note";
}

export function defaultTagForKind(kind: DeskFileKind) {
  switch (kind) {
    case "pdf":
      return "Notes";
    case "note":
      return "Note";
    case "audio":
      return "Listening";
    case "image":
      return "Image";
    case "doc":
      return "Document";
    default:
      return "File";
  }
}

/**
 * Tải file: ưu tiên bản đã lưu (dataUrl đã bake PDF/DOCX), hoặc content text đúng đuôi.
 * `{ original: true }` → sourceDataUrl (bản upload đầu) nếu có.
 */
export function downloadDeskFile(
  file: DeskFile,
  opts?: { original?: boolean },
) {
  if (typeof window === "undefined") return;
  const wantOriginal = Boolean(opts?.original);
  let href = wantOriginal ? file.sourceDataUrl || file.dataUrl : file.dataUrl;
  let filename = file.name;
  let revoke = false;

  if (wantOriginal) {
    // giữ tên gốc
  } else if (file.kind === "doc" && file.dataUrl?.startsWith("data:")) {
    if (!/\.docx?$/i.test(filename)) {
      filename = filename.replace(/\.(html?|txt|md)$/i, "") + ".docx";
    }
  } else if (
    typeof file.content === "string" &&
    file.content.length > 0 &&
    (file.kind === "note" || file.kind === "doc")
  ) {
    const body = file.content || "";
    const lower = filename.toLowerCase();
    const isMd = lower.endsWith(".md") || lower.endsWith(".markdown");
    const isHtml = lower.endsWith(".html") || lower.endsWith(".htm");
    const isPlain =
      lower.endsWith(".txt") ||
      lower.endsWith(".csv") ||
      lower.endsWith(".json") ||
      lower.endsWith(".rtf") ||
      lower.endsWith(".log");
    const looksHtml = /<\/?[a-z][\s\S]*>/i.test(body);
    let mime = "text/plain;charset=utf-8";
    if (isMd) mime = "text/markdown;charset=utf-8";
    else if (isHtml || (file.kind === "doc" && looksHtml && !file.dataUrl)) {
      mime = "text/html;charset=utf-8";
      if (!isHtml && file.kind === "doc") {
        const base = filename.replace(/\.(docx?|html?|txt|md)$/i, "");
        filename = `${base}.html`;
      }
    } else if (!isPlain && !isMd && looksHtml) {
      mime = "text/html;charset=utf-8";
      if (!isHtml) {
        const base = filename.replace(/\.(html?|txt|md)$/i, "") || "note";
        filename = `${base}.html`;
      }
    }
    const blob = new Blob([body], { type: mime });
    href = URL.createObjectURL(blob);
    revoke = true;
  }

  if (!href) return;
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  if (revoke) URL.revokeObjectURL(href);
}
