"use client";

import { useEffect, useRef, useState } from "react";
import type { BgGradient, BgMode } from "@/lib/storage-keys";
import { THEME_SOLID } from "@/lib/storage-keys";

type Props = {
  mode: BgMode;
  solid: string;
  gradient: BgGradient;
  onChange: (next: { mode: BgMode; solid: string; gradient: BgGradient }) => void;
};

const PRESETS: { label: string; hex: string }[] = [
  { label: "Paper", hex: THEME_SOLID.paper },
  { label: "Mist", hex: "#d5e3e8" },
  { label: "Moss", hex: THEME_SOLID.moss },
  { label: "Night", hex: THEME_SOLID.night },
  { label: "Ink", hex: "#15262c" },
];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] || "e9eef1";
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h: hue, s, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function normalizeHexInput(raw: string): string | null {
  const s = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return null;
}

export function BgColorPicker({ mode, solid, gradient, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<BgMode>(mode);
  const [hexDraft, setHexDraft] = useState(solid);
  const [gradTarget, setGradTarget] = useState<"a" | "b">("a");
  const rootRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);

  const activeHex = tab === "solid" ? solid : gradTarget === "a" ? gradient.a : gradient.b;
  const hsv = hexToHsv(activeHex);

  useEffect(() => {
    if (!open) return;
    setTab(mode);
    setHexDraft(mode === "solid" ? solid : gradient.a);
  }, [open, mode, solid, gradient.a]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function commitHex(hex: string) {
    if (tab === "solid") {
      onChange({ mode: "solid", solid: hex, gradient });
      setHexDraft(hex);
    } else {
      const next =
        gradTarget === "a"
          ? { ...gradient, a: hex }
          : { ...gradient, b: hex };
      onChange({ mode: "gradient", solid, gradient: next });
      setHexDraft(hex);
    }
  }

  function setFromSv(clientX: number, clientY: number) {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = clamp((clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    commitHex(hsvToHex(hsv.h, s, v));
  }

  const preview =
    mode === "gradient"
      ? `linear-gradient(${gradient.angle}deg, ${gradient.a}, ${gradient.b})`
      : solid;

  return (
    <div className="bg-color-picker" ref={rootRef}>
      <button
        type="button"
        className="bg-color-trigger"
        title="Màu nền"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="bg-color-swatch" style={{ background: preview }} />
        <span className="bg-color-label">Màu nền</span>
      </button>
      {open ? (
        <div className="bg-color-popover" role="dialog" aria-label="Màu nền">
          <div className="bg-color-tabs">
            <button
              type="button"
              className={tab === "solid" ? "active" : ""}
              onClick={() => {
                setTab("solid");
                setHexDraft(solid);
                onChange({ mode: "solid", solid, gradient });
              }}
            >
              Màu đồng nhất
            </button>
            <button
              type="button"
              className={tab === "gradient" ? "active" : ""}
              onClick={() => {
                setTab("gradient");
                setHexDraft(gradient.a);
                onChange({ mode: "gradient", solid, gradient });
              }}
            >
              Màu gradient
            </button>
          </div>

          {tab === "gradient" ? (
            <div className="bg-grad-targets">
              <button
                type="button"
                className={gradTarget === "a" ? "active" : ""}
                onClick={() => {
                  setGradTarget("a");
                  setHexDraft(gradient.a);
                }}
              >
                <i style={{ background: gradient.a }} /> A
              </button>
              <button
                type="button"
                className={gradTarget === "b" ? "active" : ""}
                onClick={() => {
                  setGradTarget("b");
                  setHexDraft(gradient.b);
                }}
              >
                <i style={{ background: gradient.b }} /> B
              </button>
              <select
                aria-label="Hướng gradient"
                value={gradient.angle}
                onChange={(e) =>
                  onChange({
                    mode: "gradient",
                    solid,
                    gradient: { ...gradient, angle: Number(e.target.value) },
                  })
                }
              >
                <option value={180}>Dọc</option>
                <option value={90}>Ngang</option>
                <option value={135}>Chéo</option>
              </select>
            </div>
          ) : null}

          <div className="bg-presets">
            {PRESETS.map((p) => (
              <button
                key={p.hex}
                type="button"
                title={p.label}
                className={activeHex.toLowerCase() === p.hex.toLowerCase() ? "active" : ""}
                style={{ background: p.hex }}
                onClick={() => commitHex(p.hex)}
              />
            ))}
          </div>

          <div
            ref={svRef}
            className="bg-sv"
            style={{
              background: `
                linear-gradient(to top, #000, transparent),
                linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))
              `,
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setFromSv(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (e.buttons !== 1) return;
              setFromSv(e.clientX, e.clientY);
            }}
          >
            <span
              className="bg-sv-thumb"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                background: activeHex,
              }}
            />
          </div>

          <input
            type="range"
            className="bg-hue"
            min={0}
            max={360}
            value={Math.round(hsv.h)}
            onChange={(e) => commitHex(hsvToHex(Number(e.target.value), hsv.s, hsv.v))}
            aria-label="Hue"
          />

          <div className="bg-hex-row">
            <span className="bg-hex-preview" style={{ background: activeHex }} />
            <input
              type="text"
              value={hexDraft}
              spellCheck={false}
              aria-label="Hex"
              onChange={(e) => {
                setHexDraft(e.target.value);
                const ok = normalizeHexInput(e.target.value);
                if (ok) commitHex(ok);
              }}
              onBlur={() => {
                const ok = normalizeHexInput(hexDraft);
                if (ok) commitHex(ok);
                else setHexDraft(activeHex);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
