"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { LearnStats } from "@/components/LearnStats";
import { RequireAuth } from "@/components/RequireAuth";
import {
  activityLast7Days,
  actionCredit,
  ensureRoadmap,
  getDailyStudyProgress,
  getTodayPlan,
  getTrack,
  isActionComplete,
  minutesToday,
  pathOverallProgress,
  studyStreak,
  tryManualMarkAction,
  weekProgress,
  type LearnState,
  type RoadmapPlan,
  type TrackId,
} from "@/lib/learn-store";
import { goalsLabel } from "@/lib/path-goals";
import { dayFocusLabel, displayDayTitle } from "@/lib/roadmap";

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
  const [state, setState] = useState<LearnState | null>(null);
  const [plan, setPlan] = useState<RoadmapPlan | null>(null);
  const [markMsg, setMarkMsg] = useState<string | null>(null);

  function refresh() {
    const s = ensureRoadmap(track);
    setState(s);
    setPlan(getTrack(s, track).roadmap);
  }

  useEffect(() => {
    function reload() {
      refresh();
    }
    reload();
    const onVis = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [track]);

  if (!state) {
    return (
      <div className="page narrow">
        <h1>Đang tải…</h1>
      </div>
    );
  }

  const trackState = getTrack(state, track);

  if (!plan) {
    const placed = trackState.placementDone && trackState.band;
    return (
      <div className="page narrow">
        <Link href="/learn" className="back">
          ← Về học
        </Link>
        <p className="eyebrow">Lộ trình · {track.toUpperCase()}</p>
        <h1>{placed ? `Band ~${trackState.band} · chưa có bài` : "Làm bài đầu vào trước"}</h1>
        <p style={{ color: "var(--muted)", margin: "12px 0 24px" }}>
          {placed
            ? "Placement đã lưu. Về trang Học để thêm 1 bài, một chương, hoặc cả cấp — không bắt buộc dựng liền."
            : "Sau placement, bạn chọn thêm bài dần trên trang Học (không tự dựng cả cấp)."}
        </p>
        {placed ? (
          <Link href={`/learn?track=${track}`}>
            <Button>Về trang Học · thêm bài</Button>
          </Link>
        ) : (
          <Link href={`/learn/placement?track=${track}`}>
            <Button>Làm placement</Button>
          </Link>
        )}
      </div>
    );
  }

  const t = getTrack(state, track);
  const progress = pathOverallProgress(track, state);
  const today = getTodayPlan(track, state);
  const daily = getDailyStudyProgress(track, state);
  const weekPercents = plan.weeks.map((w) => ({
    week: w.week,
    title: w.title,
    pct: weekProgress(track, w.week, state),
  }));

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
      {t.pathGoals ? (
        <p className="empty-hint">{goalsLabel(t.pathGoals, track)}</p>
      ) : null}
      <p className="empty-hint">
        {daily.summary} · ~{plan.newPerDay ?? "?"} từ mới/ngày · ETA ~{plan.etaWeeks ?? "?"} tuần.
        Phiên ôn ≠ cả tuần — mai tiếp tục, không reset.
      </p>

      {today ? (
        <div className="path-today-card" style={{ marginBottom: 20 }}>
          <p className="eyebrow">Hôm nay</p>
          <strong>
            Tuần {today.week.week} · {today.day.title}
          </strong>
          <p>{today.day.goal}</p>
          {today.day.samples.length > 0 ? (
            <p className="path-samples">{today.day.samples.join(" · ")}</p>
          ) : null}
          <p className="path-today-hint">{today.continueHint}</p>
          <div className="actions" style={{ marginTop: 12 }}>
            <Link href={today.day.actions[0]?.href || `/learn/review?track=${track}`}>
              <Button>Học tiếp hôm nay</Button>
            </Link>
          </div>
        </div>
      ) : null}

      <div className="roadmap-inventory">
        <div>
          <strong>{plan.inventory.vocab}</strong>
          <span>từ trong deck</span>
        </div>
        <div>
          <strong>
            {daily.touched}/{daily.total}
          </strong>
          <span>đã mở</span>
        </div>
        <div>
          <strong>
            {daily.newDoneToday}/{daily.newCap}
          </strong>
          <span>mới hôm nay</span>
        </div>
        <div>
          <strong>{progress}%</strong>
          <span>lộ trình</span>
        </div>
      </div>

      <LearnStats
        last7={activityLast7Days(state)}
        weekPercents={weekPercents}
        streak={studyStreak(state)}
        minutesToday={minutesToday(state)}
      />

      {markMsg ? <p className="empty-hint">{markMsg}</p> : null}

      <div className="roadmap-list">
        {plan.weeks.map((w) => {
          const pct = weekProgress(track, w.week, state);
          return (
            <article key={w.week} className="roadmap-week">
              <p className="eyebrow">
                Tuần {w.week} · {pct}%
              </p>
              <h3>{w.title}</h3>
              <p>{w.goal}</p>
              {w.days && w.days.length > 0 ? (
                <ol className="path-days" style={{ marginTop: 12 }}>
                  {w.days.map((d) => {
                    const isToday = today?.day.absoluteDay === d.absoluteDay;
                    return (
                      <li
                        key={d.absoluteDay}
                        className={`path-day ${isToday ? "today" : ""}`}
                      >
                        <div className="path-day-top">
                          <strong>
                            {displayDayTitle(d, track)}
                            {isToday ? " · hôm nay" : ""}
                          </strong>
                          {d.newVocabTarget > 0 ? (
                            <small>~{d.newVocabTarget} mới</small>
                          ) : (
                            <small>{dayFocusLabel(d.focus, track)}</small>
                          )}
                        </div>
                        <p>{d.goal}</p>
                        {d.samples.length > 0 ? (
                          <p className="path-samples">{d.samples.slice(0, 4).join(" · ")}</p>
                        ) : null}
                        <ul className="roadmap-actions">
                          {d.actions.map((a) => (
                            <li key={a.id}>
                              <Link href={a.href}>
                                <strong>
                                  {a.title}
                                  {typeof a.count === "number" ? ` · ${a.count}` : ""}
                                </strong>
                                <small>{a.detail}</small>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <ul className="roadmap-actions">
                  {w.actions.map((a) => {
                    const done = isActionComplete(t, a, state.reviewsToday);
                    const apct = done ? 100 : Math.round(actionCredit(t, a) * 100);
                    return (
                      <li key={a.id} className={done ? "done" : ""}>
                        <Link href={a.href}>
                          <strong>
                            {done ? "✓ " : apct > 0 ? `${apct}% · ` : ""}
                            {a.title}
                          </strong>
                          <small>
                            {a.detail}
                            {typeof a.count === "number" ? ` · ${a.count}` : ""}
                          </small>
                        </Link>
                        {!done && apct >= 50 ? (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => {
                              const res = tryManualMarkAction(track, a.id);
                              setMarkMsg(res.ok ? "Đã xác nhận việc này." : res.reason);
                              refresh();
                            }}
                          >
                            Đánh dấu xong
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
      </div>

      <p className="roadmap-foot">
        Lộ trình gắn với dữ liệu offline trong app — không phải chứng chỉ JLPT/IELTS/CEFR chính thức.
      </p>
      <div className="actions" style={{ marginTop: 16 }}>
        <Link href={`/learn/review?track=${track}`}>
          <Button>Bắt đầu phiên hôm nay</Button>
        </Link>
        <Link href={`/learn/placement?track=${track}`}>
          <Button variant="ghost">Làm lại placement</Button>
        </Link>
      </div>
    </div>
  );
}
