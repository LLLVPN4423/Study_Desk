"use client";

import { loadDesk, saveDesk, type DeskState } from "./desk-store";
import { loadLearn, saveLearn, type LearnState } from "./learn-store";
import { loadSession, saveSession, type SessionUser } from "./session";
import { STORAGE_KEYS } from "./storage-keys";

export type BackupPayload = {
  version: 1;
  exportedAt: string;
  session: SessionUser | null;
  desk: DeskState;
  learn: LearnState;
  theme?: string;
};

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

export function downloadBackup() {
  const payload = buildBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `study-desk-backup-${payload.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function restoreBackup(raw: string) {
  const data = JSON.parse(raw) as BackupPayload;
  if (!data || data.version !== 1 || !data.desk || !data.learn) {
    throw new Error("Invalid backup file.");
  }
  // Strip large dataUrls if restoring would blow storage — keep as-is for now
  saveDesk(data.desk);
  saveLearn(data.learn);
  if (data.session) saveSession(data.session);
  if (data.theme) localStorage.setItem(STORAGE_KEYS.theme, data.theme);
  return data;
}
