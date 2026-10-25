"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { StudioAudioPlayer } from "@/components/StudioAudioPlayer";
import type { DeskMusicApi } from "@/hooks/useDeskMusic";

type Props = {
  music: DeskMusicApi;
  /** chip = studio bar; panel = desk overview */
  variant?: "chip" | "panel";
  onUploadMusic?: () => void;
};

export function DeskMusicDock({ music, variant = "chip", onUploadMusic }: Props) {
  const [popOpen, setPopOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const {
    listeningFile,
    audioQueue,
    listeningIndex,
    controls,
    play,
    stop,
    goNext,
    goPrev,
  } = music;
  const keepAudio = Boolean(listeningFile?.dataUrl);

  useEffect(() => {
    if (!popOpen) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setPopOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [popOpen]);

  const player =
    keepAudio && listeningFile ? (
      <StudioAudioPlayer
        title={listeningFile.name}
        artist={
          audioQueue.length > 1
            ? `Hàng đợi ${listeningIndex + 1}/${audioQueue.length}`
            : "Study Desk · Audio"
        }
        compact
        controls={controls}
        onClose={() => {
          stop();
          setPopOpen(false);
        }}
        onPrev={audioQueue.length > 1 ? goPrev : undefined}
        onNext={audioQueue.length > 1 ? goNext : undefined}
      />
    ) : (
      <div className="music-pick">
        <header className="music-box-head">
          <span>Âm nhạc</span>
          <button type="button" className="music-box-x" onClick={() => setPopOpen(false)}>
            ×
          </button>
        </header>
        <div className="music-pick-body">
          {audioQueue.length === 0 ? (
            <p className="empty-hint">
              Chưa có nhạc nền.
              {onUploadMusic ? " Bấm Tải nhạc để thêm — tách khỏi tài liệu học." : ""}
            </p>
          ) : (
            audioQueue.map((a) => (
              <button
                key={a.id}
                type="button"
                className="music-pick-row"
                onClick={() => {
                  play(a.id);
                  setPopOpen(true);
                }}
              >
                <Icon name="audio" size={14} />
                <span>{a.name}</span>
              </button>
            ))
          )}
          {onUploadMusic ? (
            <button type="button" className="music-pick-upload" onClick={onUploadMusic}>
              <Icon name="upload" size={14} />
              Tải nhạc
            </button>
          ) : null}
        </div>
      </div>
    );

  if (variant === "panel") {
    return (
      <section className="music-dock-panel">
        <header className="schedule-box-head music-dock-head">
          <span>Âm nhạc</span>
          {onUploadMusic ? (
            <button type="button" className="text-button" onClick={onUploadMusic}>
              Tải nhạc
            </button>
          ) : null}
        </header>
        <div className="music-dock-panel-body">
          {keepAudio && listeningFile ? (
            <StudioAudioPlayer
              title={listeningFile.name}
              artist={
                audioQueue.length > 1
                  ? `Hàng đợi ${listeningIndex + 1}/${audioQueue.length}`
                  : "Study Desk · Audio"
              }
              compact
              controls={controls}
              onClose={stop}
              onPrev={audioQueue.length > 1 ? goPrev : undefined}
              onNext={audioQueue.length > 1 ? goNext : undefined}
            />
          ) : (
            <div className="music-pick-body flat">
              {audioQueue.length === 0 ? (
                <p className="empty-hint">Nhạc nền tách khỏi tài liệu — tải mp3/wav/m4a tại đây.</p>
              ) : (
                audioQueue.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="music-pick-row"
                    onClick={() => play(a.id)}
                  >
                    <Icon name="audio" size={14} />
                    <span>{a.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="studio-util-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`studio-util-chip ${popOpen ? "active" : ""} ${keepAudio ? "playing" : ""}`}
        title="Âm nhạc"
        aria-expanded={popOpen}
        onClick={() => setPopOpen((v) => !v)}
      >
        <Icon name="audio" size={16} />
      </button>
      {popOpen ? <div className="studio-util-pop music-pop is-open">{player}</div> : null}
    </div>
  );
}
