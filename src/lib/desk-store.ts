"use client";

import { FREE_LIMITS } from "./freemium";
import { STORAGE_KEYS, type ThemeId } from "./storage-keys";

export type DeskFile = {
  id: string;
  name: string;
  kind: "pdf" | "mp3";
  size: number;
  tag: string;
  folderId: string | null;
  createdAt: string;
  dataUrl?: string;
  notes?: string;
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

export type DeskState = {
  files: DeskFile[];
  folders: DeskFolder[];
  tasks: DeskTask[];
  theme: ThemeId;
  studyRoomUrl: string;
};

const defaultDesk = (): DeskState => ({
  files: [],
  folders: [
    { id: "f-jp", name: "Japanese" },
    { id: "f-en", name: "English" },
  ],
  tasks: [
    { id: "t1", title: "Review chapter 14", due: "Today, 7:00 PM", done: false },
    { id: "t2", title: "Complete 20 reviews", due: "Today", done: true },
    { id: "t3", title: "Listen: week 4 drill", due: "Tomorrow", done: false },
  ],
  theme: "paper",
  studyRoomUrl: "",
});

export function loadDesk(): DeskState {
  if (typeof window === "undefined") return defaultDesk();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.desk);
    if (!raw) return defaultDesk();
    const parsed = { ...defaultDesk(), ...JSON.parse(raw) } as DeskState;
    parsed.files = (parsed.files || []).map((f) => ({
      ...f,
      folderId: f.folderId ?? null,
    }));
    if (!parsed.folders?.length) parsed.folders = defaultDesk().folders;
    if (parsed.studyRoomUrl === undefined) parsed.studyRoomUrl = "";
    return parsed;
  } catch {
    return defaultDesk();
  }
}

export function saveDesk(state: DeskState) {
  localStorage.setItem(STORAGE_KEYS.desk, JSON.stringify(state));
  document.documentElement.dataset.theme =
    state.theme === "paper" ? "" : state.theme;
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);
}

export function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme === "paper" ? "" : theme;
}

export function usedStorageBytes(files: DeskFile[]) {
  return files.reduce((sum, f) => sum + (f.size || 0), 0);
}

export function canUpload(files: DeskFile[], size: number) {
  if (files.length >= FREE_LIMITS.maxFiles) {
    return { ok: false as const, reason: "File limit reached on Free (20)." };
  }
  if (usedStorageBytes(files) + size > FREE_LIMITS.maxStorageBytes) {
    return { ok: false as const, reason: "Storage limit reached on Free (50MB)." };
  }
  return { ok: true as const };
}

export function canAddFolder(folders: DeskFolder[]) {
  if (folders.length >= FREE_LIMITS.maxFolders) {
    return { ok: false as const, reason: `Folder limit on Free (${FREE_LIMITS.maxFolders}).` };
  }
  return { ok: true as const };
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
