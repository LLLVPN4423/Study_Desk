"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import mapData from "@/data/japan-region-paths.json";
import { REGIONS, type RegionId } from "@/data/japan-regions";

type Props = {
  selected: RegionId | "all";
  onSelect: (id: RegionId | "all") => void;
  counts: Partial<Record<RegionId, number>>;
  compact?: boolean;
};

type View = { x: number; y: number; w: number; h: number };

const BASE: View = {
  x: mapData.viewBox[0],
  y: mapData.viewBox[1],
  w: mapData.viewBox[2],
  h: mapData.viewBox[3],
};

const MIN_ZOOM = 0.85;
const MAX_ZOOM = 7;
const REGION_IDS = new Set(REGIONS.map((r) => r.id));

function clampView(v: View): View {
  const minW = BASE.w / MAX_ZOOM;
  const maxW = BASE.w / MIN_ZOOM;
  const w = Math.min(maxW, Math.max(minW, v.w));
  const h = (w / BASE.w) * BASE.h;
  const maxX = BASE.x + BASE.w - w;
  const maxY = BASE.y + BASE.h - h;
  return {
    x: Math.min(maxX, Math.max(BASE.x, v.x)),
    y: Math.min(maxY, Math.max(BASE.y, v.y)),
    w,
    h,
  };
}

function zoomAt(v: View, factor: number, cx: number, cy: number): View {
  const w = v.w / factor;
  const h = v.h / factor;
  const x = cx - ((cx - v.x) / v.w) * w;
  const y = cy - ((cy - v.y) / v.h) * h;
  return clampView({ x, y, w, h });
}

function fitBBox(bbox: number[], pad = 36): View {
  const [x0, y0, x1, y1] = bbox;
  let w = x1 - x0 + pad * 2;
  let h = y1 - y0 + pad * 2;
  const aspect = BASE.w / BASE.h;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return clampView({
    x: (x0 + x1) / 2 - w / 2,
    y: (y0 + y1) / 2 - h / 2,
    w,
    h,
  });
}

function regionFromTarget(target: EventTarget | null): RegionId | null {
  let el: Element | null = target instanceof Element ? target : null;
  while (el) {
    const id = el.getAttribute("data-region");
    if (id && REGION_IDS.has(id as RegionId)) return id as RegionId;
    el = el.parentElement;
  }
  return null;
}

function MapPin({
  x,
  y,
  active,
  count,
  scale,
}: {
  x: number;
  y: number;
  active: boolean;
  count?: number;
  scale: number;
}) {
  const s = Math.max(0.55, Math.min(1.15, 0.9 / Math.sqrt(scale)));
  return (
    <g
      className={`map-pin ${active ? "active" : ""}`}
      transform={`translate(${x} ${y}) scale(${s})`}
    >
      <ellipse cx="0" cy="2" rx="7" ry="2.4" className="map-pin-shadow" />
      <path
        d="M0 -22 C-9 -22 -14 -15 -14 -8 C-14 2 0 14 0 14 S14 2 14 -8 C14 -15 9 -22 0 -22 Z"
        className="map-pin-body"
      />
      <circle cx="0" cy="-10" r="5.2" className="map-pin-hole" />
      {typeof count === "number" ? (
        <text x="0" y="-8.5" className="map-pin-count">
          {count}
        </text>
      ) : null}
    </g>
  );
}

export function JapanRegionMap({ selected, onSelect, counts, compact }: Props) {
  const [view, setView] = useState<View>(BASE);
  const viewRef = useRef(view);
  viewRef.current = view;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const drag = useRef<{
    pointerId: number;
    sx: number;
    sy: number;
    vx: number;
    vy: number;
    moved: boolean;
    region: RegionId | null;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const byId = useMemo(() => {
    const m = new Map<string, (typeof mapData.regions)[number]>();
    for (const r of mapData.regions) m.set(r.id, r);
    return m;
  }, []);

  const zoomFactor = BASE.w / view.w;
  const inset = mapData.inset;
  const labelScale = Math.max(0.72, Math.min(1.35, 1 / Math.sqrt(zoomFactor)));

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const el = svgRef.current;
    const v = viewRef.current;
    if (!el) return { x: v.x + v.w / 2, y: v.y + v.h / 2 };
    const rect = el.getBoundingClientRect();
    return {
      x: v.x + ((clientX - rect.left) / rect.width) * v.w,
      y: v.y + ((clientY - rect.top) / rect.height) * v.h,
    };
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = clientToSvg(e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      setView((v) => zoomAt(v, factor, x, y));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clientToSvg]);

  useEffect(() => {
    if (selected === "all") {
      setView(BASE);
      return;
    }
    const r = byId.get(selected);
    if (r) setView(fitBBox(r.bbox, compact ? 48 : 32));
  }, [selected, byId, compact]);

  function toggleRegion(id: RegionId) {
    onSelect(selectedRef.current === id ? "all" : id);
  }

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      vx: view.x,
      vy: view.y,
      moved: false,
      region: regionFromTarget(e.target),
    };
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = ((e.clientX - d.sx) / rect.width) * view.w;
    const dy = ((e.clientY - d.sy) / rect.height) * view.h;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 6) d.moved = true;
    if (!d.moved) return;
    setView((v) => clampView({ ...v, x: d.vx - dx, y: d.vy - dy }));
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* already released */
    }
    if (d.moved) return;
    const id = d.region ?? regionFromTarget(e.target);
    if (id) toggleRegion(id);
  }

  return (
    <div className={`japan-map-wrap ${compact ? "is-compact" : ""}`}>
      <div className="japan-map-toolbar">
        <button
          type="button"
          className={selected === "all" ? "chip map-chip active" : "chip map-chip"}
          onClick={() => onSelect("all")}
        >
          Toàn quốc
        </button>
        {REGIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={selected === r.id ? "chip map-chip active" : "chip map-chip"}
            onClick={() => toggleRegion(r.id)}
          >
            {r.nameShort}
            {typeof counts[r.id] === "number" ? ` · ${counts[r.id]}` : ""}
          </button>
        ))}
      </div>

      <div className="japan-map-stage satellite">
        <div className="japan-map-controls" role="group" aria-label="Thu phóng bản đồ">
          <button
            type="button"
            onClick={() =>
              setView((v) => zoomAt(v, 1.25, v.x + v.w / 2, v.y + v.h / 2))
            }
            aria-label="Phóng to"
          >
            +
          </button>
          <button
            type="button"
            onClick={() =>
              setView((v) => zoomAt(v, 1 / 1.25, v.x + v.w / 2, v.y + v.h / 2))
            }
            aria-label="Thu nhỏ"
          >
            −
          </button>
          <button type="button" onClick={() => setView(BASE)} aria-label="Đặt lại">
            ↺
          </button>
          <span className="map-zoom-label">{Math.round(zoomFactor * 100)}%</span>
        </div>

        <svg
          ref={svgRef}
          className="japan-map satellite"
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          role="application"
          aria-label="Bản đồ vệ tinh các vùng Nhật Bản — chạm vùng hoặc ghim để chọn, kéo để pan"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <defs>
            <radialGradient id="sat-sea" cx="48%" cy="42%" r="68%">
              <stop offset="0%" stopColor="#3a7ea8" />
              <stop offset="45%" stopColor="#1f5a7a" />
              <stop offset="100%" stopColor="#0e3048" />
            </radialGradient>
            <linearGradient id="sat-haze" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(180,220,230,0.18)" />
              <stop offset="55%" stopColor="rgba(20,50,70,0)" />
              <stop offset="100%" stopColor="rgba(255,210,160,0.12)" />
            </linearGradient>
            <filter id="sat-noise" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.9"
                numOctaves="3"
                stitchTiles="stitch"
                result="noise"
              />
              <feColorMatrix
                type="matrix"
                values="0 0 0 0 0.15
                        0 0 0 0 0.22
                        0 0 0 0 0.18
                        0 0 0 0.22 0"
                in="noise"
                result="mono"
              />
            </filter>
            <filter id="sat-land" x="-8%" y="-8%" width="116%" height="116%">
              <feDropShadow
                dx="0"
                dy="1.2"
                stdDeviation="1.4"
                floodColor="#061820"
                floodOpacity="0.45"
              />
            </filter>
            <pattern id="sat-grain" width="80" height="80" patternUnits="userSpaceOnUse">
              <rect width="80" height="80" filter="url(#sat-noise)" />
            </pattern>
          </defs>

          <rect
            x={BASE.x}
            y={BASE.y}
            width={BASE.w}
            height={BASE.h}
            fill="url(#sat-sea)"
            pointerEvents="none"
          />
          <rect
            x={BASE.x}
            y={BASE.y}
            width={BASE.w}
            height={BASE.h}
            fill="url(#sat-grain)"
            opacity="0.55"
            pointerEvents="none"
          />
          <rect
            x={BASE.x}
            y={BASE.y}
            width={BASE.w}
            height={BASE.h}
            fill="url(#sat-haze)"
            pointerEvents="none"
          />

          {inset ? (
            <rect
              x={inset.x}
              y={inset.y}
              width={inset.w}
              height={inset.h}
              className="map-inset-frame sat"
              rx={6}
              pointerEvents="none"
            />
          ) : null}

          {/* Visual layer (filter can break hit-testing — keep non-interactive) */}
          {mapData.regions.map((r) => {
            const id = r.id as RegionId;
            const isSel = selected === id;
            const dim = selected !== "all" && !isSel;
            const meta = REGIONS.find((x) => x.id === id)!;
            return (
              <path
                key={`viz-${r.id}`}
                d={r.d}
                className={`map-region sat ${isSel ? "selected" : "lit"} ${dim ? "dim" : ""}`}
                style={{ fill: isSel ? "#c9e86a" : meta.terrain }}
                filter="url(#sat-land)"
                pointerEvents="none"
              />
            );
          })}

          {/* Hit targets — no filter, full pointer events */}
          {mapData.regions.map((r) => {
            const id = r.id as RegionId;
            return (
              <path
                key={`hit-${r.id}`}
                d={r.d}
                data-region={id}
                className="map-hit"
                fill="transparent"
                stroke="transparent"
                strokeWidth={2}
              >
                <title>{REGIONS.find((x) => x.id === id)?.nameVi}</title>
              </path>
            );
          })}

          {mapData.regions.map((r) => {
            const id = r.id as RegionId;
            const isSel = selected === id;
            const dim = selected !== "all" && !isSel;
            const meta = REGIONS.find((x) => x.id === id)!;
            const pinY = r.labelY + 10;
            return (
              <g
                key={`label-${r.id}`}
                data-region={id}
                className={`map-label-group ${dim ? "dim" : ""}`}
              >
                <MapPin
                  x={r.labelX}
                  y={pinY}
                  active={isSel || selected === "all"}
                  count={counts[id]}
                  scale={zoomFactor}
                />
                <text
                  x={r.labelX}
                  y={r.labelY - 28}
                  className={`map-label-vi ${isSel ? "hot" : ""}`}
                  style={{ fontSize: 11 * labelScale }}
                  pointerEvents="none"
                >
                  {meta.nameShort}
                </text>
                <text
                  x={r.labelX}
                  y={r.labelY - 16}
                  className="map-label-ja"
                  lang="ja"
                  style={{ fontSize: 8.5 * labelScale }}
                  pointerEvents="none"
                >
                  {meta.nameJa}
                </text>
              </g>
            );
          })}

          {inset ? (
            <text
              x={inset.x + 8}
              y={inset.y + 14}
              className="map-inset-label sat"
              pointerEvents="none"
            >
              沖縄 · Okinawa
            </text>
          ) : null}
        </svg>
      </div>

      <p className="map-hint">
        Chạm vùng hoặc ghim để chọn · kéo để pan · lăn chuột / +− để zoom.
      </p>
    </div>
  );
}
