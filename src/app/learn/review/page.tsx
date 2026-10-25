"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import { FREE_LIMITS } from "@/lib/freemium";
import type { Grade } from "@/lib/fsrs";
import {
  canReview,
  dueCards,
  getTrack,
  loadLearn,
  rateCard,
  Rating,
  type TrackId,
} from "@/lib/learn-store";
import { canSpeak, speak } from "@/lib/speech";

export default function ReviewPage() {
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
            <ReviewContent />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}

function ReviewContent() {
  const params = useSearchParams();
  const track = (params.get("track") === "en" ? "en" : "jp") as TrackId;
  const [queue, setQueue] = useState<ReturnType<typeof dueCards>>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [used, setUsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);

  function refresh(keepIndex = false) {
    const state = loadLearn();
    const next = dueCards(track, state);
    setQueue(next);
    setUsed(state.reviewsToday);
    setActive(getTrack(state, track).pathActive);
    setReady(true);
    if (!keepIndex) {
      setIndex(0);
      setFlipped(false);
    } else {
      setIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
    }
  }

  useEffect(() => {
    refresh();
  }, [track]);

  const current = queue[index];
  const remaining = queue.length;

  function goPrev() {
    setFlipped(false);
    setIndex((i) => Math.max(0, i - 1));
  }

  function goNext() {
    setFlipped(false);
    setIndex((i) => Math.min(queue.length - 1, i + 1));
  }

  function rate(grade: Grade) {
    if (!current || !flipped) return;
    const result = rateCard(current.sourceId, grade, track);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    setMessage(null);
    setUsed(result.state.reviewsToday);
    const next = dueCards(track, result.state);
    setQueue(next);
    setFlipped(false);
    setIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
  }

  if (!ready) {
    return (
      <div className="page narrow">
        <h1>Đang tải reviews…</h1>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="page narrow">
        <Link href="/learn" className="back">
          ← Về học
        </Link>
        <h1>Chưa có deck</h1>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>
          Hoàn thành placement {track.toUpperCase()} để nạp từ vào SRS.
        </p>
      </div>
    );
  }

  return (
    <div className="page narrow review-page">
      <Link href="/learn" className="back">
        ← Về học
      </Link>
      <div className="review-head">
        <div>
          <p className="eyebrow">Ôn hàng ngày · {track.toUpperCase()}</p>
          <h1>{remaining} còn lại</h1>
        </div>
        <div className="daily-cap">
          <span>
            <i style={{ width: `${(used / FREE_LIMITS.dailySrsReviews) * 100}%` }} />
          </span>
          <small>
            {used}/{FREE_LIMITS.dailySrsReviews} lượt Free hôm nay
          </small>
        </div>
      </div>

      {!canReview() ? (
        <p style={{ color: "var(--muted)", marginTop: 24 }}>
          Đã hết hạn mức ôn Free hôm nay. Mai quay lại nhé.
        </p>
      ) : !current ? (
        <p style={{ color: "var(--muted)", marginTop: 24 }}>Tạm thời hết thẻ đến hạn.</p>
      ) : (
        <>
          <div className="review-nav">
            <button type="button" className="text-button" disabled={index <= 0} onClick={goPrev}>
              ← Từ trước
            </button>
            <span>
              {index + 1} / {remaining}
            </span>
            <button
              type="button"
              className="text-button"
              disabled={index >= remaining - 1}
              onClick={goNext}
            >
              Từ sau →
            </button>
          </div>

          <button
            type="button"
            className={`flashcard ${flipped ? "flipped" : ""}`}
            onClick={() => setFlipped((v) => !v)}
          >
            <span className="card-counter">
              Session {used + 1}/{FREE_LIMITS.dailySrsReviews}
            </span>
            {!flipped ? (
              <>
                <p className="eyebrow">
                  {track === "jp" ? "Nhật · Từ vựng" : "Anh · Từ vựng"}
                </p>
                <div className="kanji" style={{ fontSize: track === "en" ? 48 : undefined }}>
                  {current.word}
                </div>
                <span className="tap">Chạm để hiện đáp án</span>
              </>
            ) : (
              <>
                <p className="eyebrow">{track === "jp" ? "Đọc · Nghĩa" : "Nghĩa"}</p>
                <div className="kanji prompt-word">{current.word}</div>
                {current.reading ? <div className="reading">{current.reading}</div> : null}
                <h2 className="meaning-line">{current.meanings.join("; ")}</h2>
                {current.exampleJa ? (
                  <p className="example">
                    {current.exampleJa}
                    <br />
                    <small>{current.exampleEn}</small>
                  </p>
                ) : null}
              </>
            )}
          </button>

          {canSpeak() ? (
            <div className="speak-row">
              <Button
                variant="secondary"
                onClick={() =>
                  speak(
                    track === "jp" ? current.reading || current.word : current.word,
                    track === "jp" ? "ja-JP" : "en-US",
                  )
                }
              >
                Nghe từ
              </Button>
              {current.exampleJa ? (
                <Button variant="ghost" onClick={() => speak(current.exampleJa || "", "ja-JP")}>
                  Nghe ví dụ
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className={`ratings ${flipped ? "enabled" : "locked"}`}>
            {!flipped ? (
              <p className="ratings-lock-hint">Lật thẻ trước khi chấm Again / Hard / Good / Easy</p>
            ) : null}
            <button
              type="button"
              className="again"
              disabled={!flipped}
              onClick={() => rate(Rating.Again)}
            >
              <strong>Again</strong>
              <small>~1 phút</small>
            </button>
            <button type="button" disabled={!flipped} onClick={() => rate(Rating.Hard)}>
              <strong>Hard</strong>
              <small>~10 phút</small>
            </button>
            <button type="button" disabled={!flipped} onClick={() => rate(Rating.Good)}>
              <strong>Good</strong>
              <small>~1 ngày</small>
            </button>
            <button type="button" disabled={!flipped} onClick={() => rate(Rating.Easy)}>
              <strong>Easy</strong>
              <small>~2 ngày</small>
            </button>
          </div>
        </>
      )}
      {message ? (
        <p style={{ color: "var(--danger)", marginTop: 16, fontSize: 13 }}>{message}</p>
      ) : null}
      <p style={{ marginTop: 24, fontSize: 11, color: "var(--muted)" }}>
        {track === "jp" ? "OpenJLPT · CC BY-SA 4.0" : "CEFR-J / TUFS"} · Luyện không chính thức
      </p>
    </div>
  );
}
