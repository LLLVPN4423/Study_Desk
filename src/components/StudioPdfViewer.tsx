"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import type { Annotation } from "@inkbar/core";
import {
  InkColorMenu,
  InkFindBar,
  InkHighlightMenu,
  InkNextPage,
  InkPageCount,
  InkPageInput,
  InkPrevPage,
  InkRedo,
  InkRoot,
  InkSearchButton,
  InkShapeMenu,
  InkSignatureMenu,
  InkTextStyleMenu,
  InkThreadPopover,
  InkToolbar,
  InkToolbarSeparator,
  InkToolButton,
  InkUndo,
  InkViewport,
  InkZoomSelect,
} from "@inkbar/react";
import "@inkbar/theme/theme.css";
import { Button } from "@/components/Button";
import { ensureMapGetOrInsertComputed } from "@/lib/map-polyfill";

// Inkbar/pdfjs may call Map.getOrInsertComputed (Chrome 145+). Scope polyfill
// to PDF studio only — not a global app boot patch.
ensureMapGetOrInsertComputed();

/** Asset local (public/pdfjs) — tránh lỗi mở PDF khi CDN/unpkg fail. */
const INKBAR_ASSETS = {
  worker: "/pdfjs/pdf.worker.min.mjs",
  cMaps: "/pdfjs/cmaps/",
  standardFonts: "/pdfjs/standard_fonts/",
  wasm: "/pdfjs/wasm/",
  icc: "/pdfjs/iccs/",
};

export type StudioPdfHandle = {
  /** Đọc chú thích hiện tại — không ghi parent (dùng khi kiểm tra dirty). */
  getAnnotations: () => Annotation[];
  /** Đẩy chú thích ra parent + trả về. */
  flush: () => Annotation[];
  /** Browser text selection inside the PDF viewport (may be empty). */
  getSelectedText: () => string;
};

type Props = {
  dataUrl: string;
  fileId: string;
  title: string;
  annotations: Annotation[];
  onAnnotationsChange: (next: Annotation[]) => void;
  pageNotes: string;
  onPageNotes: (text: string) => void;
  /** Slice 2E — create flashcard draft from PDF text selection / extract quote. */
  onCardFromText?: (payload: { text: string; page?: number }) => void;
};

export const StudioPdfViewer = forwardRef<StudioPdfHandle, Props>(function StudioPdfViewer(
  {
    dataUrl,
    fileId,
    title,
    annotations,
    onAnnotationsChange,
    pageNotes,
    onPageNotes,
    onCardFromText,
  },
  ref,
) {
  const [msg, setMsg] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [localAnn, setLocalAnn] = useState<Annotation[]>(annotations);
  const localAnnRef = useRef(localAnn);
  const onAnnRef = useRef(onAnnotationsChange);
  const saveTimer = useRef<number | null>(null);

  localAnnRef.current = localAnn;
  onAnnRef.current = onAnnotationsChange;

  // Chỉ sync annotation từ parent khi đổi file — không reset khi autosave (tránh reload loop)
  useEffect(() => {
    setLocalAnn(annotations);
    setLoadErr(null);
  }, [fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // dataUrl đổi sau bake/Thay file → nạp PDF mới, xóa overlay cũ (đã nằm trong bytes)
  const dataUrlRef = useRef(dataUrl);
  useEffect(() => {
    if (dataUrlRef.current === dataUrl) return;
    dataUrlRef.current = dataUrl;
    setLocalAnn(annotations);
    setLoadErr(null);
  }, [dataUrl, annotations]);

  useEffect(() => {
    return () => {
      // Chỉ flush khi còn debounce chưa gửi — tránh đẩy lại overlay cũ khi remount sau bake
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
        onAnnRef.current(localAnnRef.current);
      }
    };
  }, []);

  function readDomSelection(): string {
    const sel = typeof window !== "undefined" ? window.getSelection()?.toString() : "";
    return (sel || "").replace(/\s+/g, " ").trim();
  }

  useImperativeHandle(ref, () => ({
    getAnnotations: () => localAnnRef.current,
    flush: () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const next = localAnnRef.current;
      onAnnRef.current(next);
      return next;
    },
    getSelectedText: () => readDomSelection(),
  }));

  function useSelectionForCard() {
    const text = readDomSelection();
    if (!text) {
      setMsg("Chọn chữ trong PDF (công cụ Select text) rồi thử lại.");
      return;
    }
    if (!onCardFromText) {
      setMsg("Không gắn được thẻ từ PDF trong phiên này.");
      return;
    }
    onCardFromText({ text });
    setMsg("Đã đưa vùng chọn sang panel Học — chỉnh rồi Thêm thẻ.");
  }

  // key đổi khi bytes PDF đổi (bake) — không phụ thuộc updatedAt autosave
  const src = useMemo(
    () => ({
      url: dataUrl,
      key: `${fileId}:${dataUrl.length}:${dataUrl.slice(-48)}`,
    }),
    [dataUrl, fileId],
  );

  function handleAnnotations(next: Annotation[]) {
    setLocalAnn(next);
    localAnnRef.current = next;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      onAnnRef.current(next);
    }, 280);
  }

  async function extractAllText() {
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = INKBAR_ASSETS.worker; // local /pdfjs
      const raw = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      const binary = atob(raw);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      const parts: string[] = [];
      for (let i = 1; i <= Math.min(doc.numPages, 40); i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items
          .map((it) => ("str" in it ? String(it.str) : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (text) parts.push(`[PDF tr. ${i}]\n${text}`);
      }
      if (!parts.length) {
        setMsg("Không trích được chữ (PDF scan?).");
        return;
      }
      const block = parts.join("\n\n");
      onPageNotes(`${pageNotes}${pageNotes.trim() ? "\n\n" : ""}${block}`);
      setMsg(`Đã trích ${parts.length} trang → Ghi chú (tab Học).`);
    } catch {
      setMsg("Trích chữ thất bại.");
    }
  }

  function downloadAnnotations() {
    const blob = new Blob([JSON.stringify(localAnn, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = title.replace(/\.pdf$/i, "") + ".annotations.json";
    a.click();
    URL.revokeObjectURL(href);
    setMsg("Đã tải file chú thích JSON.");
  }

  function printPdf() {
    const w = window.open(dataUrl, "_blank");
    if (!w) {
      setMsg("Trình duyệt chặn popup in.");
      return;
    }
    w.addEventListener("load", () => {
      try {
        w.print();
      } catch {
        /* ignore */
      }
    });
  }

  return (
    <div className="studio-pdf-work studio-pdf-inkbar">
      {loadErr ? (
        <div className="studio-empty">
          <h2>Không mở PDF</h2>
          <p>{loadErr}</p>
          <iframe title={title} src={`${dataUrl}#toolbar=1`} className="studio-pdf-fallback" />
        </div>
      ) : (
        <InkRoot
          className="studio-ink-root light"
          src={src}
          assets={INKBAR_ASSETS}
          annotations={localAnn}
          onAnnotationsChange={handleAnnotations}
          history
          onError={(err) => setLoadErr(err.message || "Lỗi PDF")}
        >
          <InkToolbar className="studio-ink-toolbar" label="Công cụ PDF">
            <InkToolButton tool="select-text" />
            <InkToolButton tool="select" />
            <InkToolButton tool="highlight" />
            <InkHighlightMenu />
            <InkToolButton tool="note" />
            <InkToolButton tool="freetext" />
            <InkTextStyleMenu />
            <InkToolButton tool="draw" />
            <InkToolButton tool="sketch" />
            <InkToolButton tool="shape" />
            <InkShapeMenu />
            <InkToolButton tool="redact-area" />
            <InkToolButton tool="signature" />
            <InkSignatureMenu />
            <InkColorMenu property="fill" />
            <InkColorMenu property="border" />
            <InkColorMenu property="textColor" />
            <InkToolbarSeparator />
            <InkUndo />
            <InkRedo />
            <InkSearchButton />
            <InkToolbarSeparator />
            <InkPrevPage />
            <InkPageInput />
            <InkPageCount />
            <InkNextPage />
            <InkZoomSelect />
          </InkToolbar>
          <div className="studio-ink-viewport-wrap">
            <InkViewport className="studio-ink-viewport" />
          </div>
          <div className="studio-pdf-extra">
            <Button variant="secondary" onClick={() => void extractAllText()}>
              Trích chữ → Ghi chú
            </Button>
            {onCardFromText ? (
              <Button variant="secondary" onClick={useSelectionForCard}>
                Vùng chọn → thẻ
              </Button>
            ) : null}
            <Button variant="ghost" onClick={downloadAnnotations} disabled={!localAnn.length}>
              Tải chú thích ({localAnn.length})
            </Button>
            <Button variant="ghost" onClick={() => window.open(dataUrl, "_blank")}>
              Tab mới
            </Button>
            <Button variant="ghost" onClick={printPdf}>
              In
            </Button>
            {msg ? <span className="studio-msg">{msg}</span> : null}
          </div>
          <InkFindBar />
          <InkThreadPopover />
        </InkRoot>
      )}
    </div>
  );
});
