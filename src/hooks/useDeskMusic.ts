"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersistentAudio, type AudioTrack } from "@/hooks/usePersistentAudio";
import type { DeskFile, DeskState } from "@/lib/desk-store";

const LISTEN_KEY = "studydesk.listeningId";

function readSavedId() {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(LISTEN_KEY);
  } catch {
    return null;
  }
}

function writeSavedId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(LISTEN_KEY, id);
    else sessionStorage.removeItem(LISTEN_KEY);
  } catch {
    /* ignore */
  }
}

export type DeskMusicApi = ReturnType<typeof useDeskMusic>;

export function useDeskMusic(desk: DeskState | null) {
  const [listeningId, setListeningIdState] = useState<string | null>(readSavedId);
  const srcCache = useRef<Map<string, string>>(new Map());

  const setListeningId = useCallback((id: string | null) => {
    setListeningIdState(id);
    writeSavedId(id);
  }, []);

  // Tất cả file audio (kể cả lúc dataUrl chưa hydrate) — queue chỉ khi mất blob tạm thời
  const audioFiles = useMemo(
    () => (desk?.files.filter((f) => f.kind === "audio") as DeskFile[]) || [],
    [desk?.files],
  );

  useEffect(() => {
    for (const f of audioFiles) {
      if (f.dataUrl) srcCache.current.set(f.id, f.dataUrl);
    }
  }, [audioFiles]);

  // Chỉ bỏ listening khi file thật sự bị xóa — không vì mất dataUrl tạm
  useEffect(() => {
    if (!listeningId || !desk) return;
    if (!desk.files.some((f) => f.id === listeningId && f.kind === "audio")) {
      setListeningId(null);
    }
  }, [desk, listeningId, setListeningId]);

  const listeningFile = listeningId
    ? audioFiles.find((f) => f.id === listeningId) || null
    : null;
  const listeningIndex = listeningFile
    ? audioFiles.findIndex((f) => f.id === listeningFile.id)
    : -1;

  const audioQueue = useMemo(
    () =>
      audioFiles.filter(
        (f) => f.dataUrl || srcCache.current.has(f.id),
      ),
    [audioFiles],
  );

  const goNext = useCallback(() => {
    if (audioQueue.length < 2 || listeningIndex < 0) return;
    const i = (listeningIndex + 1) % audioQueue.length;
    setListeningId(audioQueue[i].id);
  }, [audioQueue, listeningIndex, setListeningId]);

  const goPrev = useCallback(() => {
    if (audioQueue.length < 2 || listeningIndex < 0) return;
    const i = (listeningIndex - 1 + audioQueue.length) % audioQueue.length;
    setListeningId(audioQueue[i].id);
  }, [audioQueue, listeningIndex, setListeningId]);

  const resolvedSrc =
    listeningFile?.dataUrl ||
    (listeningId ? srcCache.current.get(listeningId) : undefined) ||
    null;

  const audioTrack: AudioTrack | null = useMemo(
    () =>
      listeningId && resolvedSrc
        ? {
            id: listeningId,
            src: resolvedSrc,
            title: listeningFile?.name || "Audio",
          }
        : null,
    [listeningId, resolvedSrc, listeningFile?.name],
  );

  const controls = usePersistentAudio(audioTrack, { onEndedNext: goNext });

  const play = useCallback(
    (id: string) => {
      setListeningId(id);
    },
    [setListeningId],
  );

  const stop = useCallback(() => {
    controls.stop();
    setListeningId(null);
  }, [controls, setListeningId]);

  return {
    listeningId,
    setListeningId,
    listeningFile,
    audioQueue,
    listeningIndex,
    controls,
    play,
    stop,
    goNext,
    goPrev,
  };
}
