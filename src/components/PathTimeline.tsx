"use client";

import Link from "next/link";
import { dayVocabProgress, type TodayPlan } from "@/lib/learn-store";
import {
  dayFocusLabel,
  displayDayTitle,
  type RoadmapPlan,
  type TrackId,
} from "@/lib/roadmap";

type Props = {
  plan: RoadmapPlan;
  track: TrackId;
  progress: number;
  weekIndex: number;
  weekPercents: number[];
  doneActionIds: Set<string>;
  actionCredits?: Record<string, number>;
  todayPlan?: TodayPlan | null;
};

export function PathTimeline({
  plan,
  track,
  progress,
  weekIndex,
  weekPercents,
  doneActionIds,
  actionCredits = {},
  todayPlan = null,
}: Props) {
  const weeks = plan.weeks;
  const activeIdx = Math.min(weeks.length - 1, Math.max(0, weekIndex));

  return (
    <section className="path-timeline" aria-label="Lộ trình bài học">
      <div className="path-timeline-head">
        <div>
          <p className="eyebrow">Lộ trình</p>
          <h3>{plan.band} · chuỗi bài học</h3>
          <p className="path-timeline-hint">
            {track === "jp"
              ? "Mỗi ngày = một bài (từ / ngữ pháp / kanji / nghe / mock). Xong bài này học bài tiếp ngay."
              : "Mỗi ngày = một bài (từ / ngữ pháp / nghe / mock). Xong bài này học bài tiếp ngay."}
          </p>
        </div>
        <div className="path-timeline-meta">
          <strong>
            Chương {activeIdx + 1}/{weeks.length}
          </strong>
          <span>{progress}% lộ trình</span>
          {todayPlan ? (
            <span>
              Đang: bài {todayPlan.day.day}/7
            </span>
          ) : null}
        </div>
      </div>

      {todayPlan ? (
        <div className="path-today-card">
          <p className="eyebrow">Bài đang học</p>
          <strong>
            Chương {todayPlan.week.week} · {todayPlan.day.title}
          </strong>
          <p>{todayPlan.day.goal}</p>
          <p className="path-today-hint">{todayPlan.continueHint}</p>
          <div className="path-step-actions">
            <Link
              href={
                todayPlan.day.lessonId
                  ? `/learn/lessons/${encodeURIComponent(todayPlan.day.lessonId)}`
                  : todayPlan.day.actions[0]?.href || `/learn/review?track=${plan.track}`
              }
              className="button primary path-cta"
            >
              Học bài này
              {todayPlan.day.lessonKind ? ` · ${todayPlan.day.lessonKind}` : ""}
            </Link>
          </div>
        </div>
      ) : null}

      <ol className="path-steps">
        {weeks.map((w, i) => {
          const pct = weekPercents[i] ?? 0;
          const done = pct >= 80 && i < activeIdx;
          const current = i === activeIdx;
          const locked = i > activeIdx;
          const nextAction =
            w.actions.find((a) => !doneActionIds.has(a.id)) || w.actions[0];
          return (
            <li
              key={w.week}
              className={`path-step ${done || pct >= 100 ? "done" : ""} ${current ? "current" : ""}`}
            >
              <div className="path-step-rail" aria-hidden>
                <span className="path-dot">{done || pct >= 100 ? "✓" : w.week}</span>
              </div>
              <div className="path-step-body">
                <div className="path-step-top">
                  <small>
                    Chương {w.week} · {pct}%
                  </small>
                  {current ? <span className="pill-live">Đang học</span> : null}
                  {done || pct >= 100 ? <span className="pill-done">Đã qua</span> : null}
                  {locked ? <span className="pill-locked">Chưa mở</span> : null}
                </div>
                <strong>{w.title}</strong>
                <p>{w.goal}</p>

                {current && w.days && w.days.length > 0 ? (
                  <ol className="path-days">
                    {w.days.map((d) => {
                      const dp = dayVocabProgress(track, d);
                      const isCurrent = todayPlan?.day.absoluteDay === d.absoluteDay;
                      const lockedLesson =
                        !dp.done &&
                        todayPlan != null &&
                        d.absoluteDay > todayPlan.day.absoluteDay;
                      return (
                        <li
                          key={d.absoluteDay}
                          className={`path-day ${isCurrent ? "today" : ""} ${dp.done ? "done" : ""} ${lockedLesson ? "locked-lesson" : ""}`}
                        >
                          <div className="path-day-top">
                            <strong>
                              {dp.done ? "✓ " : ""}
                              {displayDayTitle(d, track)}
                              {isCurrent && !dp.done ? " · đang học" : ""}
                              {dp.done ? " · xong" : ""}
                            </strong>
                            <small>
                              {dp.total > 0
                                ? `${dp.touched}/${dp.total}`
                                : lockedLesson
                                  ? "chờ bài trước"
                                  : dayFocusLabel(d.focus, track)}
                            </small>
                          </div>
                          <p>{d.goal}</p>
                          {dp.done ? (
                            <p className="path-day-done-hint">Đã hoàn thành bài này</p>
                          ) : isCurrent ? (
                            <div className="path-step-actions">
                              {(() => {
                                // Phase 3 F2: require lesson quality, not mere touch
                                const vocabDone =
                                  !(d.vocabSourceIds?.length) ||
                                  Boolean(dp.vocabDone);
                                const skillActions = d.actions.filter((a) =>
                                  ["grammar", "kanji", "listening", "mock"].includes(a.kind),
                                );
                                const pendingSkills = dp.skillsPending?.length
                                  ? skillActions
                                  : [];
                                // Vocab still open → primary SRS; vocab done but skills left → skill CTAs
                                if (vocabDone && pendingSkills.length) {
                                  return (
                                    <>
                                      <p className="path-day-done-hint">
                                        Từ xong — còn {dp.skillsPending!.join(", ")}
                                      </p>
                                      {pendingSkills.map((a) => (
                                        <Link
                                          key={a.id}
                                          href={a.href}
                                          className="button primary path-cta"
                                        >
                                          {a.title}
                                        </Link>
                                      ))}
                                    </>
                                  );
                                }
                                return (
                                  <>
                                    <Link
                                      href={
                                        d.lessonId
                                          ? `/learn/lessons/${encodeURIComponent(d.lessonId)}`
                                          : d.actions[0]?.href || `/learn/review?track=${track}`
                                      }
                                      className="button primary path-cta"
                                    >
                                      Học bài {d.day}
                                    </Link>
                                    {d.actions.slice(1, 2).map((a) => (
                                      <Link key={a.id} href={a.href} className="path-action-link">
                                        {a.title}
                                      </Link>
                                    ))}
                                  </>
                                );
                              })()}
                            </div>
                          ) : lockedLesson ? (
                            <p className="path-day-done-hint" style={{ opacity: 0.7 }}>
                              Học xong bài trước để mở
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : current ? (
                  <div className="path-step-actions">
                    {w.actions.slice(0, 2).map((a) => {
                      const ok = doneActionIds.has(a.id);
                      const credit = actionCredits[a.id] ?? 0;
                      const apct = ok ? 100 : Math.round(credit * 100);
                      return (
                        <Link
                          key={a.id}
                          href={a.href}
                          className={`path-action-link ${ok ? "done" : ""}`}
                        >
                          {ok ? "✓ " : ""}
                          {a.title}
                          {!ok && apct > 0 ? ` · ${apct}%` : ""}
                        </Link>
                      );
                    })}
                    {nextAction ? (
                      <Link href={nextAction.href} className="button primary path-cta">
                        Tiếp tục
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
