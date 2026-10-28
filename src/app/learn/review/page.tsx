"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import { freemiumUnlocked } from "@/lib/freemium";
import type { Grade } from "@/lib/fsrs";
import {
  canReview,
  dayVocabProgress,
  ensureLessonCards,
  ensureRoadmap,
  EVIDENCE,
  getDailyStudyProgress,
  getTodayPlan,
  getTrack,
  isLessonDone,
  loadLearn,
  markLessonDone,
  pathOverallProgress,
  rateCard,
  Rating,
  recordStudyMinutes,
  studyQueue,
  vocabIdsProgress,
  type DailyStudyProgress,
  type TodayPlan,
  type TrackId,
} from "@/lib/learn-store";
import { getLesson, lessonVocabIds } from "@/lib/lessons";
import { resolveCardSourceLink } from "@/lib/card-provenance";
import { loadDesk } from "@/lib/desk-store";
import { canSpeak, speak } from "@/lib/speech";
import { useI18n } from "@/lib/i18n";
import { displayExampleVi } from "@/lib/gloss-vi";

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
  const { t } = useI18n();
  const params = useSearchParams();
  const track = (params.get("track") === "en" ? "en" : "jp") as TrackId;
  const lessonIdParam = params.get("lessonId");
  const [queue, setQueue] = useState<ReturnType<typeof studyQueue>>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [used, setUsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const [sessionRated, setSessionRated] = useState(0);
  const [daily, setDaily] = useState<DailyStudyProgress | null>(null);
  const [lesson, setLesson] = useState<TodayPlan | null>(null);
  const [lessonPct, setLessonPct] = useState({
    touched: 0,
    total: 0,
    pct: 0,
    done: false,
    goodCount: 0,
    needsQuality: false,
  });
  /** Cards graded this browser session — must grade before “Từ sau”. */
  const [ratedIds, setRatedIds] = useState<Set<string>>(() => new Set());
  const sessionRatedRef = useRef(0);
  const sessionStart = useState(() => Date.now())[0];

  useEffect(() => {
    return () => {
      const mins = (Date.now() - sessionStart) / 60000;
      if (mins >= 0.5) recordStudyMinutes(mins);
      // Phase 3 F3: do not auto-tick week review/vocab on unmount after N grades.
      // Completion stays gated by syncPathFromActivity / day-week quality rules.
    };
  }, [sessionStart, track]);

  function refresh(keepIndex = false) {
    ensureRoadmap(track);
    // Phase 3 F6: materialize missing curriculum cards for forced lesson
    if (lessonIdParam) ensureLessonCards(track, lessonIdParam);
    const state = loadLearn();
    const next = studyQueue(track, state, { lessonId: lessonIdParam });
    const t = getTrack(state, track);
    const prog = getDailyStudyProgress(track, state);
    const plan = getTodayPlan(track, state);
    setQueue(next);
    setUsed(state.reviewsToday);
    setActive(t.pathActive || t.cards.length > 0);
    setDaily(prog);
    setLesson(plan);
    // Phase 3 F4: forced lessonId progress must track that lesson, not Today
    const forcedLesson = lessonIdParam ? getLesson(lessonIdParam) : null;
    const forcedIds = forcedLesson ? lessonVocabIds(forcedLesson) : [];
    const emptyPct = {
      touched: 0,
      total: 0,
      pct: 0,
      done: false,
      goodCount: 0,
      needsQuality: false,
    };
    setLessonPct(
      forcedIds.length
        ? (() => {
            const v = vocabIdsProgress(track, forcedIds, state);
            return {
              touched: v.touched,
              total: v.total,
              pct: v.pct,
              done: v.vocabDone,
              goodCount: v.goodCount,
              needsQuality: v.needsQuality,
            };
          })()
        : plan
          ? dayVocabProgress(track, plan.day, state)
          : emptyPct,
    );
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
  }, [track, lessonIdParam]);

  const current = queue[index];
  const remaining = queue.length;
  const isNew = current?.queueKind === "new";
  const longFront = Boolean(current?.word && current.word.length > 48);
  const longMeaning = Boolean(
    current?.meanings?.join("; ") && current.meanings.join("; ").length > 80,
  );
  const sourceNav = useMemo(() => {
    if (!current || (!current.sourceFileId && !current.sourceAnchor)) return null;
    try {
      const deskFiles = loadDesk().files.map((f) => ({ id: f.id, name: f.name }));
      return resolveCardSourceLink(current, deskFiles);
    } catch {
      return {
        ok: false as const,
        reason: "file_missing" as const,
        message: "Không đọc được danh sách file trên bàn.",
      };
    }
  }, [current]);

  function goPrev() {
    setFlipped(false);
    setIndex((i) => Math.max(0, i - 1));
  }

  function goNext() {
    if (!current || !ratedIds.has(current.sourceId)) {
      setMessage(t("srsGradeBeforeNext"));
      return;
    }
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
    const nextRated = sessionRated + 1;
    setSessionRated(nextRated);
    sessionRatedRef.current = nextRated;
    setRatedIds((prev) => new Set(prev).add(current.sourceId));
    setUsed(result.state.reviewsToday);
    const prog = getDailyStudyProgress(track, result.state);
    const plan = getTodayPlan(track, result.state);
    setDaily(prog);
    setLesson(plan);
    const forcedLesson = lessonIdParam ? getLesson(lessonIdParam) : null;
    const forcedIds = forcedLesson ? lessonVocabIds(forcedLesson) : [];
    const forcedProg = forcedIds.length
      ? vocabIdsProgress(track, forcedIds, result.state)
      : null;
    const dayProg = plan ? dayVocabProgress(track, plan.day, result.state) : null;
    const activeProg = forcedProg
      ? {
          touched: forcedProg.touched,
          total: forcedProg.total,
          pct: forcedProg.pct,
          done: forcedProg.vocabDone,
          goodCount: forcedProg.goodCount,
          needsQuality: forcedProg.needsQuality,
          skillsPending: [] as string[],
        }
      : dayProg;
    setLessonPct(
      activeProg
        ? {
            touched: activeProg.touched,
            total: activeProg.total,
            pct: activeProg.pct,
            done: activeProg.done,
            goodCount: activeProg.goodCount,
            needsQuality: activeProg.needsQuality,
          }
        : { touched: 0, total: 0, pct: 0, done: false, goodCount: 0, needsQuality: false },
    );
    const pct = pathOverallProgress(track, result.state);
    const uniq = getTrack(result.state, track).evidence?.reviewIds?.length || 0;
    const kindLabel = current.queueKind === "new" ? "Từ mới" : "Ôn lại";
    const lessonDone = activeProg?.done ?? false;
    if (!forcedProg && lessonDone && plan?.day.lessonId) {
      markLessonDone(track, plan.day.lessonId);
    }
    if (lessonIdParam && isLessonDone(track, lessonIdParam, result.state)) {
      markLessonDone(track, lessonIdParam);
    }
    const skillsLeft = activeProg?.skillsPending?.length
      ? ` · còn ${activeProg.skillsPending.join(", ")} trước khi sang bài tiếp`
      : "";
    setMessage(
      lessonDone
        ? `${kindLabel} ✓ · Xong bài — có thể học bài tiếp ngay · Lộ trình ${pct}%`
        : activeProg?.needsQuality
          ? `${kindLabel} ✓ · Cần ≥70% Ổn/Dễ (hiện ${activeProg.goodCount}/${activeProg.total}) — từ Lại/Khó sẽ hỏi lại`
          : activeProg && activeProg.touched >= activeProg.total && activeProg.total > 0 && skillsLeft
            ? `${kindLabel} ✓ · Từ bài này đạt${skillsLeft} · Lộ trình ${pct}%`
            : `${kindLabel} ✓ · Bài ${plan?.day.day ?? "?"} · Lộ trình ${pct}% · SRS ${uniq}/${EVIDENCE.reviewUnique}`,
    );
    const next = studyQueue(track, result.state, { lessonId: lessonIdParam });
    setQueue(next);
    setFlipped(false);
    setIndex(0);
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
          Làm placement rồi trên trang Học thêm 1 bài / chương để nạp từ vào SRS ({track.toUpperCase()}).
        </p>
        <p style={{ marginTop: 16 }}>
          <Link href={`/learn?track=${track}`}>
            <Button>Về trang Học</Button>
          </Link>
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
          <p className="eyebrow">
            {lesson
              ? `Chương ${lesson.week.week} · ${lesson.day.title}`
              : `Ôn · ${track.toUpperCase()}`}
          </p>
          <h1>{remaining} thẻ trong bài</h1>
          <p className="review-summary">
            {lessonPct.total > 0
              ? `Tiến độ bài: ${lessonPct.touched}/${lessonPct.total} từ · Ổn/Dễ ${lessonPct.goodCount ?? 0}/${lessonPct.total} (cần ≥70%)`
              : daily?.summary || ""}
            <br />
            <span style={{ color: "var(--ink)" }}>
              Phải chấm từng thẻ — không bỏ qua. Lại/Khó sẽ được hỏi lại đến khi đạt.
            </span>
          </p>
        </div>
        <div className="daily-cap">
          <span>
            <i
              style={{
                width: `${lessonPct.total ? Math.min(100, lessonPct.pct) : 0}%`,
              }}
            />
          </span>
          <small>
            {lessonPct.total
              ? `Bài ${lessonPct.touched}/${lessonPct.total}`
              : `${used} lượt`}
          </small>
        </div>
      </div>

      {!canReview() ? (
        <p style={{ color: "var(--muted)", marginTop: 24 }}>
          Hết hạn mức phiên. Thử lại sau.
        </p>
      ) : !current ? (
        <div style={{ marginTop: 24 }}>
          <p style={{ color: "var(--ink)", fontWeight: 600 }}>
            {lessonPct.done
              ? "Đã xong bài này — quay lại Learn để học bài tiếp."
              : lessonPct.needsQuality
                ? `Chưa đạt ≥70% Ổn/Dễ (${lessonPct.goodCount ?? 0}/${lessonPct.total}). Tải lại để ôn các từ Lại/Khó.`
                : "Hết thẻ trong hàng đợi — tải lại để tiếp tục bài hiện tại."}
          </p>
          <p style={{ color: "var(--muted)", marginTop: 8 }}>
            <Link href={`/learn?track=${track}`}>
              <Button>{lessonPct.done ? "Về lộ trình · bài tiếp" : "Về lộ trình"}</Button>
            </Link>
            {!lessonPct.done ? (
              <>
                {" · "}
                <button type="button" className="text-button" onClick={() => refresh()}>
                  Tiếp tục ôn bài này
                </button>
              </>
            ) : null}
          </p>
        </div>
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
              disabled={index >= remaining - 1 || !ratedIds.has(current.sourceId)}
              onClick={goNext}
              title={
                !ratedIds.has(current.sourceId)
                  ? "Chấm thẻ trước khi sang từ sau"
                  : undefined
              }
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
              {isNew ? "Từ mới" : "Ôn lại"}
              {daily ? ` · mới ${daily.newDoneToday}/${daily.newCap}` : ""}
            </span>
            {!flipped ? (
              <>
                <p className="eyebrow">
                  {isNew ? "Mở thẻ mới hôm nay" : "Ôn lại (FSRS) — không phải học lại từ đầu"}
                </p>
                <div
                  className={`kanji${longFront ? " kanji-long" : ""}`}
                  style={
                    !longFront && track === "en" ? { fontSize: 48 } : undefined
                  }
                >
                  {current.word}
                </div>
                <span className="tap">Chạm để hiện đáp án</span>
              </>
            ) : (
              <>
                <p className="eyebrow">{track === "jp" ? "Đọc · Nghĩa" : "Nghĩa"}</p>
                <div className={`kanji prompt-word${longFront ? " kanji-long" : ""}`}>
                  {current.word}
                </div>
                {current.reading ? <div className="reading">{current.reading}</div> : null}
                <h2 className={`meaning-line${longMeaning ? " meaning-long" : ""}`}>
                  {current.meanings.join("; ")}
                </h2>
                {current.exampleJa ? (
                  <p className="example">
                    {current.exampleJa}
                    <br />
                    <small>
                      {displayExampleVi(track, current.sourceId) || current.exampleEn}
                    </small>
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
              {current.exampleJa || current.exampleEn ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    speak(
                      track === "jp"
                        ? current.exampleJa || current.word
                        : current.exampleEn || current.word,
                      track === "jp" ? "ja-JP" : "en-US",
                    )
                  }
                >
                  Nghe ví dụ
                </Button>
              ) : null}
            </div>
          ) : null}

          {sourceNav?.ok ? (
            <p style={{ marginTop: 12, fontSize: 13 }}>
              <Link href={sourceNav.href} className="text-button">
                {sourceNav.kind === "culture" ? "Mở di sản" : "Mở nguồn"} · {sourceNav.fileName}
                {sourceNav.page ? ` · tr.${sourceNav.page}` : ""}
              </Link>
              {sourceNav.quote ? (
                <span style={{ color: "var(--muted)", display: "block", marginTop: 4 }}>
                  “{sourceNav.quote.slice(0, 100)}
                  {sourceNav.quote.length > 100 ? "…" : ""}”
                </span>
              ) : null}
            </p>
          ) : sourceNav && !sourceNav.ok ? (
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
              {sourceNav.message}
            </p>
          ) : null}

          <p className="ratings-lock-hint">{t("srsFlipFirst")}</p>
          <div className={`ratings two-col ${flipped ? "" : "locked"}`}>
            <button
              type="button"
              className="again"
              disabled={!flipped}
              onClick={() => rate(Rating.Again)}
            >
              <strong>{t("srsAgain")}</strong>
              <small>{t("srsAgainHint")}</small>
            </button>
            <button type="button" disabled={!flipped} onClick={() => rate(Rating.Hard)}>
              <strong>{t("srsHard")}</strong>
              <small>{t("srsHardHint")}</small>
            </button>
            <button type="button" disabled={!flipped} onClick={() => rate(Rating.Good)}>
              <strong>{t("srsGood")}</strong>
              <small>{t("srsGoodHint")}</small>
            </button>
            <button type="button" disabled={!flipped} onClick={() => rate(Rating.Easy)}>
              <strong>{t("srsEasy")}</strong>
              <small>{t("srsEasyHint")}</small>
            </button>
          </div>
        </>
      )}

      {message ? (
        <p className="empty-hint" style={{ marginTop: 16 }}>
          {message}
        </p>
      ) : null}

      <p className="roadmap-foot" style={{ marginTop: 24 }}>
        OpenJLPT · CC BY-SA 4.0 · Luyện không chính thức
      </p>
    </div>
  );
}
