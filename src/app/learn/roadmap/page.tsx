"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import {
  ensureRoadmap,
  getTrack,
  loadLearn,
  pathProgress,
  type RoadmapPlan,
  type TrackId,
} from "@/lib/learn-store";

export default function RoadmapPage() {
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
            <RoadmapContent />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}

function RoadmapContent() {
  const params = useSearchParams();
  const track = (params.get("track") === "en" ? "en" : "jp") as TrackId;
  const [plan, setPlan] = useState<RoadmapPlan | null>(null);
  const [progress, setProgress] = useState(0);
  const [cardCount, setCardCount] = useState(0);

  useEffect(() => {
    const state = ensureRoadmap(track);
    const t = getTrack(state, track);
    setPlan(t.roadmap);
    setProgress(pathProgress(track, state));
    setCardCount(t.cards.length);
  }, [track]);

  if (!plan) {
    return (
      <div className="page narrow">
        <Link href="/learn" className="back">
          ← Về học
        </Link>
        <p className="eyebrow">Lộ trình · {track.toUpperCase()}</p>
        <h1>Làm bài đầu vào trước</h1>
        <p style={{ color: "var(--muted)", margin: "12px 0 24px" }}>
          Sau placement, app dựng lộ trình từ ngân hàng từ / kanji / grammar / mock có sẵn.
        </p>
        <Link href={`/learn/placement?track=${track}`}>
          <Button>Làm placement</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <Link href="/learn" className="back">
        ← Về học
      </Link>
      <p className="eyebrow">
        {track === "jp" ? "Tiếng Nhật" : "Tiếng Anh"} · Band {plan.band}
      </p>
      <h1>Lộ trình của bạn</h1>
      <p className="roadmap-summary">{plan.summary}</p>

      <div className="roadmap-inventory">
        <div>
          <strong>{plan.inventory.vocab}</strong>
          <span>từ trong SRS</span>
        </div>
        {plan.inventory.kanji > 0 ? (
          <div>
            <strong>{plan.inventory.kanji}</strong>
            <span>kanji</span>
          </div>
        ) : null}
        <div>
          <strong>{plan.inventory.grammar}</strong>
          <span>grammar</span>
        </div>
        <div>
          <strong>{plan.inventory.mocks}</strong>
          <span>mock</span>
        </div>
        <div>
          <strong>{progress}%</strong>
          <span>SRS đã chạm ({cardCount} thẻ)</span>
        </div>
      </div>

      <div className="roadmap-list">
        {plan.weeks.map((w) => (
          <article key={w.week} className="roadmap-week">
            <p className="eyebrow">Tuần {w.week}</p>
            <h3>{w.title}</h3>
            <p>{w.goal}</p>
            {w.samples.length > 0 ? (
              <p className="roadmap-samples">
                Ví dụ từ dữ liệu: {w.samples.join(" · ")}
              </p>
            ) : null}
            <ul className="roadmap-actions">
              {w.actions.map((a) => (
                <li key={a.id}>
                  <Link href={a.href}>
                    <strong>{a.title}</strong>
                    <small>
                      {a.detail}
                      {typeof a.count === "number" ? ` · ${a.count}` : ""}
                    </small>
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <p className="roadmap-foot">
        Lộ trình gắn với dữ liệu offline trong app — không phải chứng chỉ JLPT/IELTS/CEFR chính thức.
      </p>
      <div className="actions" style={{ marginTop: 16 }}>
        <Link href={`/learn/review?track=${track}`}>
          <Button>Bắt đầu ôn SRS</Button>
        </Link>
        <Link href={`/learn/placement?track=${track}`}>
          <Button variant="ghost">Làm lại placement</Button>
        </Link>
      </div>
    </div>
  );
}
