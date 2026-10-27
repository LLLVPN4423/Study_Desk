"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/Button";

type Props = {
  open: boolean;
  fileName?: string;
  /** Chưa gắn file trên máy — cần hỏi lưu ra đâu. */
  needsDiskLink?: boolean;
  onSaveToDisk: () => void;
  onSaveBrowserOnly: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

/** Popup giữa viewport (portal → body) khi rời file đang dirty. */
export function SaveLeaveDialog({
  open,
  fileName,
  needsDiskLink = false,
  onSaveToDisk,
  onSaveBrowserOnly,
  onDiscard,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="save-leave-backdrop"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="save-leave-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-leave-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="save-leave-eyebrow">Study Desk</p>
        <h2 id="save-leave-title">Lưu thay đổi?</h2>
        <p>
          {fileName ? (
            <>
              “<strong>{fileName}</strong>” có chỉnh sửa chưa lưu
              {needsDiskLink ? " ra máy" : ""}.
            </>
          ) : (
            <>Có chỉnh sửa chưa lưu trên bàn học.</>
          )}
        </p>
        <p className="save-leave-note">
          {needsDiskLink ? (
            <>
              Ghi ra máy (chọn thư mục/tên) để lần sau Ctrl+S cập nhật như file mở từ
              máy. Hoặc chỉ giữ trên bàn (trình duyệt).
            </>
          ) : (
            <>Lưu trên bàn và ghi đè file trên máy nếu đã gắn — không upload đám mây.</>
          )}
        </p>
        <div className="save-leave-actions">
          <Button variant="ghost" onClick={onCancel}>
            Ở lại
          </Button>
          <Button variant="secondary" onClick={onDiscard}>
            Không lưu
          </Button>
          {needsDiskLink ? (
            <>
              <Button variant="secondary" onClick={onSaveBrowserOnly}>
                Chỉ bàn
              </Button>
              <Button onClick={onSaveToDisk}>Lưu ra máy…</Button>
            </>
          ) : (
            <Button onClick={onSaveToDisk}>Lưu rồi tiếp</Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
