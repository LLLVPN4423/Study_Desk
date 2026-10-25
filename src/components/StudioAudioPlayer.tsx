"use client";

import { Icon } from "@/components/Icon";

export type AudioControls = {
  playing: boolean;
  t: number;
  dur: number;
  rate: number;
  setRate: (n: number) => void;
  loop: boolean;
  setLoop: (v: boolean | ((p: boolean) => boolean)) => void;
  err: string | null;
  toggle: () => void;
  seek: (n: number) => void;
};

type Props = {
  title: string;
  artist?: string;
  compact?: boolean;
  controls: AudioControls;
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

const RATES = [0.75, 1, 1.25, 1.5] as const;

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function displayTitle(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

/** UI only — engine sống ở usePersistentAudio, không remount khi đổi PDF/note. */
export function StudioAudioPlayer({
  title,
  artist,
  compact,
  controls,
  onClose,
  onPrev,
  onNext,
}: Props) {
  const { playing, t, dur, rate, setRate, loop, setLoop, err, toggle, seek } = controls;

  function cycleRate() {
    const i = RATES.indexOf(rate as (typeof RATES)[number]);
    setRate(RATES[(i + 1) % RATES.length]);
  }

  if (compact) {
    return (
      <aside className="music-box" role="region" aria-label="Âm nhạc">
        <header className="music-box-head">
          <span>Âm nhạc</span>
          {onClose ? (
            <button type="button" className="music-box-x" onClick={onClose} aria-label="Đóng">
              ×
            </button>
          ) : null}
        </header>
        <div className="music-box-body">
          <div className="music-box-track">
            <div className="music-box-art" aria-hidden>
              <Icon name="audio" size={28} />
            </div>
            <div className="music-box-meta">
              <strong title={title}>{displayTitle(title)}</strong>
              <small>{artist || "Study Desk · Audio"}</small>
            </div>
          </div>
          <div className="music-box-seek">
            <input
              type="range"
              min={0}
              max={dur || 0}
              step={0.1}
              value={Math.min(t, dur || 0)}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Tiến trình"
            />
            <div className="music-box-times">
              <span>{fmt(t)}</span>
              <span>{fmt(dur)}</span>
            </div>
          </div>
          <div className="music-box-controls">
            <button type="button" className="music-box-side" onClick={cycleRate} title="Tốc độ phát">
              {rate}×
            </button>
            <button
              type="button"
              className="music-box-nav"
              onClick={onPrev}
              disabled={!onPrev}
              aria-label="Bài trước"
            >
              ‹‹
            </button>
            <button
              type="button"
              className="music-box-play"
              onClick={toggle}
              aria-label={playing ? "Pause" : "Play"}
            >
              <Icon name={playing ? "reset" : "play"} size={22} />
            </button>
            <button
              type="button"
              className="music-box-nav"
              onClick={onNext}
              disabled={!onNext}
              aria-label="Bài sau"
            >
              ››
            </button>
            <button
              type="button"
              className={`music-box-side ${loop ? "on" : ""}`}
              onClick={() => setLoop((v) => !v)}
              title="Lặp lại"
              aria-pressed={loop}
            >
              ↻
            </button>
          </div>
          {err ? <p className="music-box-err">{err}</p> : null}
        </div>
      </aside>
    );
  }

  return (
    <div className="studio-audio-player">
      <div className="studio-audio-art" aria-hidden>
        <Icon name="audio" size={48} />
      </div>
      <p className="eyebrow">Listening</p>
      <h2>{displayTitle(title)}</h2>
      <input
        className="studio-seek"
        type="range"
        min={0}
        max={dur || 0}
        step={0.1}
        value={Math.min(t, dur || 0)}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Tua nhạc"
      />
      <div className="studio-audio-times">
        <span>{fmt(t)}</span>
        <span>{fmt(dur)}</span>
      </div>
      <div className="studio-audio-controls">
        <button type="button" className="button primary studio-play-btn" onClick={toggle}>
          <Icon name={playing ? "reset" : "play"} size={22} />
          {playing ? "Pause" : "Play"}
        </button>
      </div>
      {err ? <p className="studio-msg">{err}</p> : null}
    </div>
  );
}
