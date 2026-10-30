"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import { loadDesk, saveDeskMetadata } from "@/lib/desk-store";
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
    saveDeskMetadata({ ...desk, studyRoomUrl: url.trim() });
  }

  return (
    <div className="page narrow">
      <p className="eyebrow">{t("navRooms")}</p>
      <h1>{t("roomsTitle")}</h1>
      <p style={{ color: "var(--muted)", margin: "12px 0 28px" }}>{t("roomsSub")}</p>

      <section className="question" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>{t("meetZoomTitle")}</h2>
        <label>
          {t("roomUrl")}
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("roomUrlPlaceholder")}
          />
        </label>
        <div className="actions" style={{ marginTop: 12 }}>
          <Button onClick={saveUrl}>{t("saveLink")}</Button>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="button secondary">
              {t("openRoom")}
            </a>
          )}
        </div>
      </section>

      <section className="question">
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>{t("livekitTitle")}</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: livekitConfigured ? 16 : 0 }}>
          {livekitConfigured ? t("livekitReady") : t("livekitMissing")}
        </p>
        {/* Avoid a writable room-name field that implies join works when LiveKit is unset. */}
        {livekitConfigured ? (
          <label>
            {t("roomNameLabel")}
            <input value={roomName} onChange={(e) => setRoomName(e.target.value)} />
          </label>
        ) : null}
      </section>
    </div>
  );
}
