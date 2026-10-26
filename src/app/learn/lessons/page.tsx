"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import {
  bandsForLessons,
  listLessons,
  type LessonKind,
} from "@/lib/lessons";
import {
  addLessonsToPath,
  isLessonDone,
  isLessonInPath,
  loadLearn,
  type TrackId,
} from "@/lib/learn-store";

const KINDS: { id: LessonKind | "all"; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "vocab", label: "Từ vựng" },
  { id: "grammar", label: "Ngữ pháp" },
  { id: "kanji", label: "Kanji" },
  { id: "listening", label: "Nghe" },
  { id: "mock", label: "Mock" },
];

export default function LessonsPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <Suspense
            fallback={
              <div className="page">
                <h1>Đang tải…</h1>
              </div>
            }
          >
            <LessonsContent />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}

function LessonsContent() {
  const params = useSearchParams();
  const track = (params.get("track") === "en" ? "en" : "jp") as TrackId;
  const state = loadLearn();
  const t = track === "jp" ? state.jp : state.en;
  const bands = bandsForLessons(track);
  const defaultBand =
    t.band && (bands as readonly string[]).includes(t.band) ? t.band : bands[0];

  const [band, setBand] = useState(defaultBand);
  const [kind, setKind] = useState<LessonKind | "all">("all");
  const [msg, setMsg] = useState<string | null>(null);
  const [, bump] = useState(0);

  const lessons = useMemo(
    () => listLessons({ track, band, kind }),
    [track, band, kind],
  );

  function refresh() {
    bump((n) => n + 1);
  }

  return (
    <div className="page">
      <Link href={`/learn?track=${track}`} className="back">
        ← Về học
      </Link>
      <p className="eyebrow">Thư viện bài học · {track.toUpperCase()}</p>
      <h1>Bài học</h1>
      <p style={{ color: "var(--muted)", margin: "8px 0 20px", maxWidth: 520 }}>
        Gói từ / ngữ pháp / kanji / nghe / mock theo cấp. Học lẻ hoặc thêm vào lộ trình sau
        placement.
      </p>

      <div className="catalog-filters" style={{ marginBottom: 16 }}>
        <label className="field-block" style={{ margin: 0 }}>
          <span>Band</span>
          <select value={band} onChange={(e) => setBand(e.target.value)}>
            {bands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="chip-row" style={{ marginBottom: 20 }}>
        {KINDS.filter((k) => !(k.id === "kanji" && track === "en")).map((k) => (
          <button
            key={k.id}
            type="button"
            className={kind === k.id ? "selected" : ""}
            onClick={() => setKind(k.id)}
          >
            {k.label}
          </button>
        ))}
      </div>

      {msg ? <p className="empty-hint">{msg}</p> : null}

      <div className="catalog-list">
        {lessons.map((lesson) => {
          const done = isLessonDone(track, lesson.id);
          const inPath = isLessonInPath(track, lesson.id);
          return (
            <article key={lesson.id} className="catalog-row">
              <div>
                <strong>{lesson.title}</strong>
                <p>
                  {lesson.kind} · {lesson.items.length} mục · ~{lesson.estMinutes} phút
                  {done ? " · xong" : ""}
                  {inPath ? " · trong path" : ""}
                </p>
                <small>{lesson.id}</small>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Link
                  href={`/learn/lessons/${encodeURIComponent(lesson.id)}?from=library`}
                >
                  <Button variant="secondary">Học</Button>
                </Link>
                {t.placementDone && t.band === band && !inPath ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const res = addLessonsToPath(track, [lesson.id]);
                      setMsg(res.message);
                      refresh();
                    }}
                  >
                    + Path
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {!lessons.length ? (
        <p className="empty-hint">Không có bài cho bộ lọc này.</p>
      ) : null}
    </div>
  );
}
