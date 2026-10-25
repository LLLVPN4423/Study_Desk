"use client";

import { useRef, type PointerEvent, type WheelEvent } from "react";

type Props = {
  totalSeconds: number;
  onChange: (next: number) => void;
  running?: boolean;
};

const MIN_TOTAL = 60;
const MAX_TOTAL = 99 * 60 + 59;

function clamp(n: number) {
  return Math.min(MAX_TOTAL, Math.max(MIN_TOTAL, Math.round(n)));
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Digital MM : SS — drag or scroll each segment to tune. */
export function DigitalFocusClock({ totalSeconds, onChange, running }: Props) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const drag = useRef<{
    part: "m" | "s";
    startY: number;
    startVal: number;
  } | null>(null);

  function applyPart(part: "m" | "s", value: number) {
    const m = part === "m" ? value : mins;
    const s = part === "s" ? value : secs;
    onChange(clamp(Math.min(99, Math.max(0, m)) * 60 + Math.min(59, Math.max(0, s))));
  }

  function onPointerDown(part: "m" | "s", e: PointerEvent<HTMLButtonElement>) {
    if (running) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      part,
      startY: e.clientY,
      startVal: part === "m" ? mins : secs,
    };
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || running) return;
    const delta = Math.round((d.startY - e.clientY) / 14);
    applyPart(d.part, d.startVal + delta);
  }

  function onPointerUp() {
    drag.current = null;
  }

  function onWheel(part: "m" | "s", e: WheelEvent<HTMLButtonElement>) {
    if (running) return;
    e.preventDefault();
    e.stopPropagation();
    applyPart(part, (part === "m" ? mins : secs) + (e.deltaY < 0 ? 1 : -1));
  }

  return (
    <div className={`digital-clock ${running ? "running" : ""}`} aria-label="Đồng hồ tập trung">
      <div className="digital-clock-face">
        <button
          type="button"
          className="digit-group"
          disabled={running}
          onPointerDown={(e) => onPointerDown("m", e)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => onWheel("m", e)}
          aria-label="Phút"
          title="Kéo hoặc lăn để chỉnh phút"
        >
          <span className="digits">{pad(mins)}</span>
          <small>phút</small>
        </button>
        <span className="clock-colon" aria-hidden>
          :
        </span>
        <button
          type="button"
          className="digit-group"
          disabled={running}
          onPointerDown={(e) => onPointerDown("s", e)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => onWheel("s", e)}
          aria-label="Giây"
          title="Kéo hoặc lăn để chỉnh giây"
        >
          <span className="digits">{pad(secs)}</span>
          <small>giây</small>
        </button>
      </div>
      <p className="clock-hint">
        {running ? "Đang chạy" : "Kéo dọc / lăn chuột trên phút hoặc giây"}
      </p>
    </div>
  );
}
