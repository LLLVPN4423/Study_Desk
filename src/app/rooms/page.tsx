"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import { loadDesk, saveDesk } from "@/lib/desk-store";
import { useI18n } from "@/lib/i18n";

/**
 * LiveKit is optional and free-tier friendly:
 * - Without env: paste Meet/Zoom (already $0)
 * - With NEXT_PUBLIC_LIVEKIT_URL + token endpoint later: embed room
 * We do NOT require a paid LiveKit plan to use Study Desk.
 */
export default function RoomsPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <RoomsContent />
        </AppShell>
      )}
    </RequireAuth>
  );
}

function RoomsContent() {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [roomName, setRoomName] = useState("study-desk-room");
  const livekitConfigured = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);

  useEffect(() => {
    setUrl(loadDesk().studyRoomUrl || "");
  }, []);

  function saveUrl() {
    const desk = loadDesk();
    saveDesk({ ...desk, studyRoomUrl: url.trim() });
  }

  return (
    <div className="page narrow">
      <p className="eyebrow">{t("navRooms")}</p>
      <h1>{t("roomsTitle")}</h1>
      <p style={{ color: "var(--muted)", margin: "12px 0 28px" }}>{t("roomsSub")}</p>

      <section className="question" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>Meet / Zoom (miễn phí)</h2>
        <label>
          URL phòng học
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://meet.google.com/… hoặc Zoom"
          />
        </label>
        <div className="actions" style={{ marginTop: 12 }}>
          <Button onClick={saveUrl}>Lưu link</Button>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="button secondary">
              Mở phòng
            </a>
          )}
        </div>
      </section>

      <section className="question">
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>LiveKit (tuỳ chọn)</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
          {livekitConfigured
            ? "Đã thấy NEXT_PUBLIC_LIVEKIT_URL — có thể tích hợp token server sau."
            : "Chưa cấu hình LiveKit. Giữ Meet/Zoom là đủ và không tốn tiền. Khi muốn: tạo dự án LiveKit Cloud free tier, thêm URL vào .env.local (không commit secret)."}
        </p>
        <label>
          Tên phòng (cho lần tích hợp sau)
          <input value={roomName} onChange={(e) => setRoomName(e.target.value)} />
        </label>
        <p style={{ marginTop: 14, fontSize: 12, color: "var(--muted)" }}>
          Self-host / Cloud free tier đều được; Study Desk không bắt buộc bật LiveKit để học.
        </p>
      </section>
    </div>
  );
}
