"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { FREE_LIMITS } from "@/lib/freemium";
import {
  canReview,
  dueCards,
  getTrack,
  loadLearn,
  rateCard,
  Rating,
  type TrackId,
} from "@/lib/learn-store";
import type { Grade } from "@/lib/fsrs";
import { canSpeak, speak } from "@/lib/speech";
import { Button } from "@/components/Button";

export default function ReviewPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <Suspense fallback={<div className="page"><h1>Loading…</h1></div>}>
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
  const [flipped, setFlipped] = useState(false);
  const [used, setUsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);

  function refresh() {
    const state = loadLearn();
    setQueue(dueCards(track, state));
    setUsed(state.reviewsToday);
    setActive(getTrack(state, track).pathActive);
    setReady(true);
  }

  useEffect(() => {
    refresh();
  }, [track]);

  const current = queue[0];
  const remaining = queue.length;

  function rate(grade: Grade) {
    if (!current) return;
    const result = rateCard(current.sourceId, grade, track);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    setFlipped(false);
    setMessage(null);
    setUsed(result.state.reviewsToday);
    setQueue(dueCards(track, result.state));
  }

  if (!ready) {
    return (
      <div className="page narrow">
        <h1>Loading reviews…</h1>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="page narrow">
        <Link href="/learn" className="back">
          ← Back to learn
        </Link>
        <h1>No deck yet</h1>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>
          Finish {track.toUpperCase()} placement to seed vocabulary into SRS.
        </p>
      </div>
    );
  }

  return (
    <div className="page narrow review-page">
      <Link href="/learn" className="back">
        ← Back to learn
      </Link>
      <div className="review-head">
        <div>
          <p className="eyebrow">Daily review · {track.toUpperCase()}</p>
          <h1>{remaining} remaining</h1>
        </div>
        <div className="daily-cap">
          <span>
            <i style={{ width: `${(used / FREE_LIMITS.dailySrsReviews) * 100}%` }} />
          </span>
          <small>
            {used} of {FREE_LIMITS.dailySrsReviews} daily Free reviews used
          </small>
        </div>
      </div>

      {!canReview() ? (
        <p style={{ color: "var(--muted)", marginTop: 24 }}>
          Daily Free review cap reached. Come back tomorrow.
        </p>
      ) : !current ? (
        <p style={{ color: "var(--muted)", marginTop: 24 }}>You’re all caught up for now.</p>
      ) : (
        <>
          <button
            type="button"
            className={`flashcard ${flipped ? "flipped" : ""}`}
            onClick={() => setFlipped((v) => !v)}
          >
            <span className="card-counter">
              {used + 1} / {FREE_LIMITS.dailySrsReviews}
            </span>
            {flipped ? (
              <>
                <p className="eyebrow">{track === "jp" ? "Reading" : "Meaning"}</p>
                {current.reading && <div className="reading">{current.reading}</div>}
                <h2>{current.meanings.join("; ")}</h2>
                {current.exampleJa && (
                  <p className="example">
                    {current.exampleJa}
                    <br />
                    <small>{current.exampleEn}</small>
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="eyebrow">
                  {track === "jp" ? "Japanese · Vocabulary" : "English · Vocabulary"}
                </p>
                <div className="kanji" style={{ fontSize: track === "en" ? 48 : undefined }}>
                  {current.word}
                </div>
                <span className="tap">Tap to reveal</span>
              </>
            )}
          </button>
          {canSpeak() && (
            <div className="speak-row">
              <Button
                variant="secondary"
                onClick={() =>
                  speak(
                    track === "jp"
                      ? current.reading || current.word
                      : current.word,
                    track === "jp" ? "ja-JP" : "en-US",
                  )
                }
              >
                Nghe từ (TTS miễn phí)
              </Button>
              {current.exampleJa && (
                <Button
                  variant="ghost"
                  onClick={() => speak(current.exampleJa || "", "ja-JP")}
                >
                  Nghe ví dụ
                </Button>
              )}
            </div>
          )}
          <div className="ratings">
            <button type="button" className="again" onClick={() => rate(Rating.Again)}>
              <strong>Again</strong>
              <small>1 min</small>
            </button>
            <button type="button" onClick={() => rate(Rating.Hard)}>
              <strong>Hard</strong>
              <small>10 min</small>
            </button>
            <button type="button" onClick={() => rate(Rating.Good)}>
              <strong>Good</strong>
              <small>~1 day</small>
            </button>
            <button type="button" onClick={() => rate(Rating.Easy)}>
              <strong>Easy</strong>
              <small>~2 days</small>
            </button>
          </div>
        </>
      )}
      {message && (
        <p style={{ color: "var(--danger)", marginTop: 16, fontSize: 13 }}>{message}</p>
      )}
      <p style={{ marginTop: 24, fontSize: 11, color: "var(--muted)" }}>
        {track === "jp"
          ? "Vocab seed: OpenJLPT (CC BY-SA 4.0)"
          : "Vocab seed: CEFR-J / TUFS (cite ATTRIBUTION.md)"}{" "}
        · Unofficial practice
      </p>
    </div>
  );
}
