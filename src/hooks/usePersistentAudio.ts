"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AudioTrack = {
  id: string;
  src: string;
  title: string;
  artist?: string;
};

type Options = {
  onEndedNext?: () => void;
};

/**
 * One Audio element for the Studio lifetime — đổi file PDF/note không remount → không phát lại từ đầu.
 * Chỉ đổi src khi track.id đổi.
 */
export function usePersistentAudio(track: AudioTrack | null, options?: Options) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackIdRef = useRef<string | null>(null);
  const loopRef = useRef(false);
  const onEndedNextRef = useRef(options?.onEndedNext);
  onEndedNextRef.current = options?.onEndedNext;

  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  loopRef.current = loop;

  // Create element once; wire listeners once
  useEffect(() => {
    const a = new Audio();
    audioRef.current = a;
    const onTime = () => setT(a.currentTime);
    const onMeta = () => setDur(a.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      if (!loopRef.current) onEndedNextRef.current?.();
    };
    const onErr = () => {
      setErr("Không phát được.");
      setPlaying(false);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnd);
    a.addEventListener("error", onErr);
    return () => {
      a.pause();
      a.removeAttribute("src");
      a.load();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("error", onErr);
      audioRef.current = null;
      trackIdRef.current = null;
    };
  }, []);

  // Swap source only when track id changes.
  // track === null tạm thời (hydrate): giữ nguyên audio đang phát — chỉ stop() mới gỡ src.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!track) return;
    if (trackIdRef.current === track.id) return;
    trackIdRef.current = track.id;
    a.src = track.src;
    a.playbackRate = rate;
    a.loop = loopRef.current;
    setT(0);
    setErr(null);
    void a
      .play()
      .then(() => setPlaying(true))
      .catch(() => setErr("Bấm Play để nghe."));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đổi bài khi id đổi
  }, [track?.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loop;
  }, [loop]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !trackIdRef.current) return;
    if (a.paused) {
      void a.play().then(() => setErr(null));
    } else {
      a.pause();
    }
  }, []);

  const seek = useCallback((value: number) => {
    const a = audioRef.current;
    if (!a || !Number.isFinite(value)) return;
    a.currentTime = value;
    setT(value);
  }, []);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.removeAttribute("src");
    a.load();
    trackIdRef.current = null;
    setPlaying(false);
    setT(0);
    setDur(0);
  }, []);

  return {
    playing,
    t,
    dur,
    rate,
    setRate,
    loop,
    setLoop,
    err,
    toggle,
    seek,
    stop,
  };
}
