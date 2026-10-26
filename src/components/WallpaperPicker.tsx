"use client";

import { useRef, useState } from "react";
import type { WallpaperId } from "@/lib/storage-keys";

const PRESETS: { id: Exclude<WallpaperId, "custom">; label: string }[] = [
  { id: "none", label: "Không" },
  { id: "mist", label: "Mist" },
  { id: "grove", label: "Grove" },
  { id: "dusk", label: "Dusk" },
  { id: "ocean", label: "Ocean" },
];

type Props = {
  wallpaper: WallpaperId;
  onSelect: (id: WallpaperId) => void;
  onUploadCustom: (dataUrl: string) => void | Promise<void>;
};

const MAX_EDGE = 1280;
const MAX_BYTES = 900_000;

async function resizeImageFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Không đọc được ảnh"));
      el.src = url;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    let quality = 0.85;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > MAX_BYTES && quality > 0.45) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (dataUrl.length > MAX_BYTES * 1.4) {
      throw new Error("Ảnh vẫn quá lớn sau khi nén");
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function WallpaperPicker({ wallpaper, onSelect, onUploadCustom }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="wallpaper-picker">
      <div className="wallpaper-grid">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`wallpaper-thumb wall-${p.id} ${wallpaper === p.id ? "active" : ""}`}
            onClick={() => onSelect(p.id)}
          >
            <span>{p.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={`wallpaper-thumb wall-custom ${wallpaper === "custom" ? "active" : ""}`}
          disabled={busy}
          onClick={() => {
            if (wallpaper === "custom") {
              onSelect("custom");
              return;
            }
            inputRef.current?.click();
          }}
        >
          <span>{busy ? "…" : wallpaper === "custom" ? "Đổi ảnh" : "Ảnh của bạn"}</span>
        </button>
        {wallpaper === "custom" ? (
          <button
            type="button"
            className="text-button"
            style={{ gridColumn: "1 / -1", justifySelf: "start" }}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            Chọn ảnh khác…
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setErr(null);
          void resizeImageFile(file)
            .then(async (dataUrl) => {
              await onUploadCustom(dataUrl);
              onSelect("custom");
            })
            .catch((ex: unknown) => {
              setErr(ex instanceof Error ? ex.message : "Upload thất bại");
            })
            .finally(() => setBusy(false));
        }}
      />
      {err ? <p className="empty-hint">{err}</p> : null}
    </div>
  );
}
