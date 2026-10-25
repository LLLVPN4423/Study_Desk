/**
 * Gộp chú thích Inkbar vào bytes PDF (pdf-lib), để Lưu/Tải ra đúng file .pdf đã sửa.
 * Vẽ trực tiếp lên trang (flatten) — mở được ở mọi reader.
 */

import {
  PDFDocument,
  rgb,
  degrees,
  StandardFonts,
  type PDFPage,
  type RGB,
} from "pdf-lib";
// PDFPage used in helpers below

export type BakeAnnotation = {
  type: string;
  page: number;
  rect?: { x: number; y: number; width: number; height: number };
  color?: string;
  borderColor?: string;
  interiorColor?: string;
  opacity?: number;
  contents?: string;
  quads?: Array<{
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    p3: { x: number; y: number };
    p4: { x: number; y: number };
  }>;
  inklist?: Array<Array<{ x: number; y: number }>>;
  vertices?: Array<{ x: number; y: number }>;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  width?: number;
  imagedata?: string;
  rotation?: 0 | 90 | 180 | 270;
  defaultStyle?: {
    color?: string;
    fontSize?: number;
    textAlign?: string;
  };
  shape?: "rect" | "ellipse";
};

function parseColor(input: string | undefined, fallback: RGB = rgb(1, 0.85, 0)): RGB {
  if (!input) return fallback;
  const s = input.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex.slice(0, 6);
    if (full.length !== 6) return fallback;
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return fallback;
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = Number(m[3]);
    const scale = a > 1 || b > 1 || c > 1 ? 255 : 1;
    return rgb(a / scale, b / scale, c / scale);
  }
  return fallback;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const raw = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToPdfDataUrl(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

function quadBounds(q: NonNullable<BakeAnnotation["quads"]>[number]) {
  const xs = [q.p1.x, q.p2.x, q.p3.x, q.p4.x];
  const ys = [q.p1.y, q.p2.y, q.p3.y, q.p4.y];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function drawMarkup(
  page: PDFPage,
  ann: BakeAnnotation,
  kind: "highlight" | "underline" | "strikeout" | "squiggly",
) {
  const color = parseColor(ann.color, rgb(1, 0.9, 0.2));
  const opacity = Math.min(1, Math.max(0.15, ann.opacity ?? 0.4));
  const boxes =
    ann.quads && ann.quads.length
      ? ann.quads.map(quadBounds)
      : ann.rect
        ? [ann.rect]
        : [];
  for (const box of boxes) {
    if (box.width <= 0 || box.height <= 0) continue;
    if (kind === "highlight") {
      page.drawRectangle({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        color,
        opacity,
        borderWidth: 0,
      });
    } else if (kind === "underline") {
      page.drawLine({
        start: { x: box.x, y: box.y },
        end: { x: box.x + box.width, y: box.y },
        thickness: Math.max(1, (ann.width ?? 1.2) * 0.8),
        color,
        opacity: Math.max(opacity, 0.7),
      });
    } else if (kind === "strikeout") {
      const mid = box.y + box.height / 2;
      page.drawLine({
        start: { x: box.x, y: mid },
        end: { x: box.x + box.width, y: mid },
        thickness: Math.max(1, ann.width ?? 1.2),
        color,
        opacity: Math.max(opacity, 0.7),
      });
    } else {
      // squiggly — đường gợn đơn giản
      const y = box.y + 1;
      const amp = Math.min(2.5, box.height * 0.25);
      const step = 4;
      let prev = { x: box.x, y };
      for (let x = box.x + step, i = 0; x <= box.x + box.width; x += step, i++) {
        const next = { x, y: y + (i % 2 === 0 ? amp : -amp) };
        page.drawLine({
          start: prev,
          end: next,
          thickness: 1,
          color,
          opacity: Math.max(opacity, 0.7),
        });
        prev = next;
      }
    }
  }
}

function drawInk(page: PDFPage, ann: BakeAnnotation) {
  const color = parseColor(ann.color, rgb(0.1, 0.2, 0.9));
  const opacity = Math.min(1, Math.max(0.2, ann.opacity ?? 1));
  const thickness = Math.max(0.5, ann.width ?? 2);
  for (const stroke of ann.inklist || []) {
    for (let i = 1; i < stroke.length; i++) {
      page.drawLine({
        start: stroke[i - 1]!,
        end: stroke[i]!,
        thickness,
        color,
        opacity,
      });
    }
  }
}

function drawPoly(page: PDFPage, ann: BakeAnnotation, closed: boolean) {
  const pts = ann.vertices || [];
  if (pts.length < 2) return;
  const color = parseColor(ann.color, rgb(0.2, 0.2, 0.2));
  const fill = ann.interiorColor ? parseColor(ann.interiorColor) : undefined;
  const opacity = Math.min(1, Math.max(0.2, ann.opacity ?? 1));
  const thickness = Math.max(0.5, ann.width ?? 1.5);
  if (closed && fill && pts.length >= 3) {
    // pdf-lib không có fillPolygon — xấp xỉ bằng hình chữ nhật bao
    if (ann.rect) {
      page.drawRectangle({
        x: ann.rect.x,
        y: ann.rect.y,
        width: ann.rect.width,
        height: ann.rect.height,
        color: fill,
        opacity: opacity * 0.35,
        borderWidth: 0,
      });
    }
  }
  for (let i = 1; i < pts.length; i++) {
    page.drawLine({
      start: pts[i - 1]!,
      end: pts[i]!,
      thickness,
      color,
      opacity,
    });
  }
  if (closed && pts.length >= 3) {
    page.drawLine({
      start: pts[pts.length - 1]!,
      end: pts[0]!,
      thickness,
      color,
      opacity,
    });
  }
}

/**
 * Bake annotations into PDF data URL. Returns original dataUrl if nothing to bake.
 */
export async function bakePdfAnnotations(
  dataUrl: string,
  annotations: unknown[],
): Promise<{ dataUrl: string; baked: number }> {
  const list = (annotations || []).filter(
    (a): a is BakeAnnotation =>
      Boolean(a) && typeof a === "object" && typeof (a as BakeAnnotation).type === "string",
  );
  if (!list.length) return { dataUrl, baked: 0 };

  const pdfDoc = await PDFDocument.load(dataUrlToBytes(dataUrl), {
    ignoreEncryption: true,
  });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  let baked = 0;

  for (const ann of list) {
    const page = pages[ann.page];
    if (!page) continue;
    const type = ann.type;

    try {
      if (
        type === "highlight" ||
        type === "underline" ||
        type === "strikeout" ||
        type === "squiggly"
      ) {
        drawMarkup(page, ann, type);
        baked++;
        continue;
      }

      if (type === "ink") {
        drawInk(page, ann);
        baked++;
        continue;
      }

      if (type === "line" && ann.start && ann.end) {
        page.drawLine({
          start: ann.start,
          end: ann.end,
          thickness: Math.max(0.5, ann.width ?? 1.5),
          color: parseColor(ann.color),
          opacity: Math.min(1, Math.max(0.2, ann.opacity ?? 1)),
        });
        baked++;
        continue;
      }

      if (type === "polyline") {
        drawPoly(page, ann, false);
        baked++;
        continue;
      }

      if (type === "polygon") {
        drawPoly(page, ann, true);
        baked++;
        continue;
      }

      if (type === "square" && ann.rect) {
        page.drawRectangle({
          x: ann.rect.x,
          y: ann.rect.y,
          width: ann.rect.width,
          height: ann.rect.height,
          borderColor: parseColor(ann.color ?? ann.borderColor),
          borderWidth: Math.max(0.5, ann.width ?? 1.5),
          color: ann.interiorColor ? parseColor(ann.interiorColor) : undefined,
          opacity: Math.min(1, Math.max(0.15, ann.opacity ?? 1)),
          borderOpacity: Math.min(1, Math.max(0.15, ann.opacity ?? 1)),
        });
        baked++;
        continue;
      }

      if (type === "circle" && ann.rect) {
        page.drawEllipse({
          x: ann.rect.x + ann.rect.width / 2,
          y: ann.rect.y + ann.rect.height / 2,
          xScale: Math.abs(ann.rect.width / 2),
          yScale: Math.abs(ann.rect.height / 2),
          borderColor: parseColor(ann.color ?? ann.borderColor),
          borderWidth: Math.max(0.5, ann.width ?? 1.5),
          color: ann.interiorColor ? parseColor(ann.interiorColor) : undefined,
          opacity: Math.min(1, Math.max(0.15, ann.opacity ?? 1)),
          borderOpacity: Math.min(1, Math.max(0.15, ann.opacity ?? 1)),
        });
        baked++;
        continue;
      }

      if ((type === "freetext" || type === "text") && ann.rect) {
        const text = (ann.contents || "").trim() || (type === "text" ? "📝" : "");
        if (!text && type === "freetext") continue;
        const style = ann.defaultStyle;
        const size = Math.max(8, Math.min(36, style?.fontSize ?? 12));
        const color = parseColor(style?.color || ann.color, rgb(0.1, 0.1, 0.1));
        if (type === "text" && !ann.contents) {
          // sticky note pin
          page.drawRectangle({
            x: ann.rect.x,
            y: ann.rect.y,
            width: Math.max(14, ann.rect.width),
            height: Math.max(14, ann.rect.height),
            color: parseColor(ann.color, rgb(1, 0.85, 0.2)),
            opacity: 0.95,
            borderWidth: 0,
          });
        } else {
          page.drawText(text.slice(0, 2000), {
            x: ann.rect.x + 2,
            y: ann.rect.y + Math.max(2, ann.rect.height - size - 2),
            size,
            font,
            color,
            opacity: Math.min(1, Math.max(0.5, ann.opacity ?? 1)),
            maxWidth: Math.max(20, ann.rect.width - 4),
            lineHeight: size * 1.25,
          });
        }
        baked++;
        continue;
      }

      if ((type === "redact" || type === "mask") && ann.rect) {
        const isRedact = type === "redact";
        const fill = parseColor(
          ann.interiorColor || ann.color,
          isRedact ? rgb(0, 0, 0) : rgb(0.2, 0.2, 0.2),
        );
        const coverOpacity = isRedact ? 1 : Math.min(1, ann.opacity ?? 0.6);
        if (!isRedact && ann.shape === "ellipse") {
          page.drawEllipse({
            x: ann.rect.x + ann.rect.width / 2,
            y: ann.rect.y + ann.rect.height / 2,
            xScale: Math.abs(ann.rect.width / 2),
            yScale: Math.abs(ann.rect.height / 2),
            color: fill,
            opacity: coverOpacity,
            borderWidth: 0,
          });
        } else if (ann.quads?.length) {
          for (const q of ann.quads) {
            const box = quadBounds(q);
            page.drawRectangle({
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              color: fill,
              opacity: coverOpacity,
              borderWidth: 0,
            });
          }
        } else {
          page.drawRectangle({
            x: ann.rect.x,
            y: ann.rect.y,
            width: ann.rect.width,
            height: ann.rect.height,
            color: fill,
            opacity: coverOpacity,
            borderWidth: 0,
          });
        }
        baked++;
        continue;
      }

      if (type === "stamp" && ann.imagedata && ann.rect) {
        const raw = ann.imagedata;
        let image;
        if (/^data:image\/jpe?g/i.test(raw) || raw.includes("/9j/")) {
          image = await pdfDoc.embedJpg(dataUrlToBytes(raw));
        } else {
          image = await pdfDoc.embedPng(dataUrlToBytes(raw));
        }
        page.drawImage(image, {
          x: ann.rect.x,
          y: ann.rect.y,
          width: ann.rect.width,
          height: ann.rect.height,
          rotate: degrees(ann.rotation || 0),
          opacity: Math.min(1, Math.max(0.2, ann.opacity ?? 1)),
        });
        baked++;
        continue;
      }
    } catch {
      // bỏ annotation lỗi, tiếp tục các cái khác
    }
  }

  if (!baked) return { dataUrl, baked: 0 };
  const out = await pdfDoc.save({ useObjectStreams: false });
  return { dataUrl: bytesToPdfDataUrl(out), baked };
}
