"use client";

import { STORAGE_KEYS } from "./storage-keys";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  plan: "free" | "pro";
};

export function loadSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.session);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function saveSession(user: SessionUser) {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}

export function displayNameFromEmail(email: string) {
  const local = email.split("@")[0] || "You";
  return local.charAt(0).toUpperCase() + local.slice(1);
}
